import path from "path";
import {
  PLAN_PROMPT,
  DEV_PROMPT,
  QA_PROMPT,
  DEFAULT_EPIC,
} from "./templates.js";
import { TaskManager, type StatusData } from "./task-manager.js";
import { LLMCaller } from "./llm-caller.js";
import {
  parseTaskId,
  parseTaskTitle,
  parseTaskDescription,
  parseRemainingTasks,
  parseBlockedInfo,
  parseJsonTaskList,
} from "./parse-output.js";
import { RalphFileManager } from "./ralph-file-manager.js";
import { SettingsManager, DEFAULT_SETTINGS, type Settings } from "./settings-manager.js";
import { GitManager } from "./git-manager.js";

const DEFAULT_EPIC_NORMALIZED = DEFAULT_EPIC.replace(/\r\n/g, "\n").trim();

export interface LoopCallbacks {
  onLog: (line: string) => void;
  onLoopStatus: (status: string, error: string | null) => void;
  onTasksUpdated: (data: StatusData) => void;
}

// --- Loop Class ---

export class RalphLoop {
  readonly repoRoot: string;
  readonly ralphDir: string;
  private running = false;
  private activeRunPromise: Promise<void> | null = null;
  private runGeneration = 0;
  private stopRequestedRunId: number | null = null;
  private cb: LoopCallbacks;
  private taskManager: TaskManager;
  private fileManager: RalphFileManager;
  private settingsManager: SettingsManager;
  private gitManager: GitManager;
  private llmCaller: LLMCaller;
  private completedEpic = false;

  constructor(repoRoot: string, callbacks: LoopCallbacks) {
    this.repoRoot = path.resolve(repoRoot);
    this.ralphDir = path.join(this.repoRoot, "ralph");
    this.cb = callbacks;
    this.taskManager = new TaskManager(this.ralphDir, (data) => callbacks.onTasksUpdated(data));
    this.fileManager = new RalphFileManager(this.ralphDir);
    this.settingsManager = new SettingsManager(this.ralphDir);
    this.gitManager = new GitManager(this.repoRoot);
    this.llmCaller = new LLMCaller(() => this.running);
  }

  get isRunning() {
    return this.running;
  }

  // --- Bootstrap ---

  async bootstrap(): Promise<void> {
    await this.fileManager.bootstrap(
      PLAN_PROMPT,
      DEV_PROMPT,
      QA_PROMPT,
      DEFAULT_EPIC,
      JSON.stringify(DEFAULT_SETTINGS, null, 2)
    );
  }

  get didCompleteEpic() {
    return this.completedEpic;
  }

  // --- Git helpers ---

  async getCurrentBranch(): Promise<string> {
    return this.gitManager.getCurrentBranch();
  }

  // --- Requirements check ---

  async checkRequirements(): Promise<string | null> {
    return this.gitManager.checkRequirements();
  }

  // --- Start / Stop ---

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.running) return { ok: false, error: "Loop is already running" };

    await this.waitForIdle();

    const epicConfigured = await this.isEpicConfigured();
    if (!epicConfigured) {
      return {
        ok: false,
        error: "Epic is not configured. Update ralph/epic.md with your current epic before starting.",
      };
    }

    const reqFile = await this.checkRequirements();
    if (!reqFile) {
      return {
        ok: false,
        error: "No requirements document found. Add a requirements.md to the repo root before starting.",
      };
    }

    const runId = ++this.runGeneration;
    this.running = true;
    this.completedEpic = false;
    this.stopRequestedRunId = null;
    this.cb.onLoopStatus("running", null);
    this.cb.onLog(`[system] Ralph loop started (requirements: ${reqFile})`);

    // Run in background — don't await
    const runPromise = this.runLoop();
    this.activeRunPromise = runPromise;
    runPromise
      .then(() => {
        this.finishRun(runId);
      })
      .catch((err: Error) => {
        this.finishRun(runId, err);
      })
      .finally(() => {
        if (this.activeRunPromise === runPromise) {
          this.activeRunPromise = null;
        }
      });

    return { ok: true };
  }

  stop(): { ok: boolean; error?: string } {
    if (!this.running) return { ok: false, error: "Loop is not running" };
    this.stopRequestedRunId = this.runGeneration;
    this.running = false;
    this.llmCaller.stop();
    this.cb.onLoopStatus("stopped", null);
    this.cb.onLog("[system] Ralph loop stopped by user");
    return { ok: true };
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    if (this.running) this.stop();
    await this.waitForIdle();
    return this.start();
  }

  async shutdown(): Promise<void> {
    if (this.running) {
      this.stop();
    }
    await this.waitForIdle();
  }

  // --- Backlog Refresh ---

  private refreshing = false;

  get isRefreshing() {
    return this.refreshing;
  }

  async refreshBacklog(): Promise<{ ok: boolean; error?: string }> {
    if (this.refreshing) return { ok: false, error: "Backlog refresh already in progress" };

    const reqFile = await this.checkRequirements();
    if (!reqFile) {
      return { ok: false, error: "No requirements document found" };
    }

    this.refreshing = true;
    this.cb.onLog("[system] Refreshing backlog...");

    try {
      await this.bootstrap();
      const settings = await this.settingsManager.read();
      const planPrompt = await this.fileManager.read("plan-prompt.md");
      const refreshInstruction = [
        "",
        "## Backlog Refresh Mode",
        "Refresh the task list only.",
        "Do not include <task-id>.",
        "Do not include implementation-ready task prose.",
      ].join("\n");

      const output = await this.llmCaller.call(
        `${planPrompt}\n${refreshInstruction}`,
        settings.planModel,
        this.repoRoot,
        {}
      );

      if (output.includes("<status>complete</status>")) {
        // Project complete — clear backlog
        const data = await this.taskManager.readStatus();
        data.tasks = data.tasks.filter((t) => t.status !== "backlog");
        await this.taskManager.writeStatus(data);
        this.cb.onLog("[system] Backlog refresh: project appears complete");
      } else {
        const parsedTasks = parseJsonTaskList(output);
        if (parsedTasks.length > 0) {
          await this.taskManager.syncBacklogTasks(parsedTasks);
          this.cb.onLog(`[system] Backlog refreshed: ${parsedTasks.length} tasks`);
        } else {
          const remainingTasks = parseRemainingTasks(output);
          if (remainingTasks.length > 0) {
            await this.taskManager.syncBacklogTasksByTitle(remainingTasks);
            this.cb.onLog(`[system] Backlog refreshed: ${remainingTasks.length} tasks`);
          } else {
            this.cb.onLog("[system] Backlog refresh: no tasks parsed from output");
          }
        }
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.cb.onLog(`[system] Backlog refresh failed: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      this.refreshing = false;
    }
  }

  // --- Main Loop ---

  private async runLoop(): Promise<void> {
    await this.bootstrap();

    let iteration = 0;
    let totalLLMCalls = 0;

    // Initialize — preserve existing tasks, only reset session counters
    const initSettings = await this.settingsManager.read();
    const existingStatus = await this.taskManager.readStatus();
    await this.taskManager.writeStatus({
      ...existingStatus,
      totalLLMCalls: 0,
      maxLLMCalls: initSettings.maxLLMCalls,
      nextTask: {
        taskId: null,
        content: "",
        updatedAt: new Date().toISOString(),
      },
      feedback: {
        taskId: null,
        content: "",
        updatedAt: new Date().toISOString(),
      },
    });

    let tasksSincePlan = 0;

    while (this.running) {
      // Re-read settings each iteration to pick up control panel changes
      const settings = await this.settingsManager.read();
      if (totalLLMCalls >= settings.maxLLMCalls) {
        this.cb.onLog(
          `[system] Max LLM calls reached (${totalLLMCalls}/${settings.maxLLMCalls})`
        );
        break;
      }

      // Check if we should skip planning (use cached backlog instead)
      const currentStatus = await this.taskManager.readStatus();
      const backlogCount = currentStatus.tasks.filter((t) => t.status === "backlog").length;
      const shouldPlan =
        iteration === 0 ||
        tasksSincePlan >= settings.planFrequency ||
        backlogCount < settings.minBacklogSize;

      iteration++;

      if (!shouldPlan && backlogCount > 0) {
        // Pick the first backlog task without re-planning
        const nextBacklog = currentStatus.tasks.find((t) => t.status === "backlog");
        if (nextBacklog) {
          this.cb.onLog(`[system] Skipping plan phase (${backlogCount} backlog tasks, plan every ${settings.planFrequency} tasks)`);
          const effectiveTaskId = nextBacklog.id;
          const title = nextBacklog.title;

          await this.taskManager.setTaskStatus(
            effectiveTaskId,
            "inProgress",
            totalLLMCalls,
            settings.maxLLMCalls,
          );

          // Build a task description for dev/QA from the stored entry
          const nextTaskContent = `## Task: ${nextBacklog.title}\n\n${nextBacklog.description}`;
          await this.taskManager.setNextTaskContent(effectiveTaskId, nextTaskContent);

          // --- Dev + QA loop (shared with plan-based path) ---
          const devResult = await this.runDevQALoop(
            effectiveTaskId,
            title,
            nextTaskContent,
            totalLLMCalls,
          );
          totalLLMCalls = devResult.totalLLMCalls;
          tasksSincePlan++;
          continue;
        }
      }

      this.cb.onLog(`[system] Planning iteration #${iteration}...`);
      tasksSincePlan = 0;

      // --- Plan phase ---
      const planPrompt = await this.fileManager.read("plan-prompt.md");
      let nextTaskContent: string;
      try {
        nextTaskContent = await this.llmCaller.call(
          planPrompt,
          settings.planModel,
          this.repoRoot,
          {}
        );
      } catch (err) {
        throw new Error(`Plan phase failed: ${err}`);
      }
      totalLLMCalls++;

      // Check if all tasks are done
      if (nextTaskContent.includes("<status>complete</status>")) {
        this.cb.onLog(`[system] All tasks completed after ${iteration - 1} tasks.`);
        this.completedEpic = true;
        const statusData = await this.taskManager.readStatus();
        statusData.tasks = statusData.tasks.filter(
          (t) => t.status !== "backlog"
        );
        statusData.totalLLMCalls = totalLLMCalls;
        statusData.nextTask = {
          taskId: null,
          content: "",
          updatedAt: new Date().toISOString(),
        };
        statusData.feedback = {
          taskId: null,
          content: "",
          updatedAt: new Date().toISOString(),
        };
        await this.taskManager.writeStatus(statusData);
        break;
      }

      // Sync remaining tasks from plan output to ensure backlog is preserved
      // This acts as a fallback if the plan agent didn't write task-status.json correctly
      const remainingTasks = parseRemainingTasks(nextTaskContent);
      const parsedTaskList = parseJsonTaskList(nextTaskContent);
      if (parsedTaskList.length > 0) {
        await this.taskManager.syncBacklogTasks(parsedTaskList);
        this.cb.onLog(`[system] Synced ${parsedTaskList.length} tasks from plan output (json)`);
      } else if (remainingTasks.length > 0) {
        await this.taskManager.syncBacklogTasksByTitle(remainingTasks);
        this.cb.onLog(`[system] Synced ${remainingTasks.length} tasks from plan output`);
      }

      // Plan agent updates task-status.json and signals which task to work on next
      const taskId = parseTaskId(nextTaskContent);
      if (taskId === null) {
        this.cb.onLog("[system] Warning: plan output missing <task-id> signal — falling back to title/description parse.");
      }

      // Re-read task-status.json — plan agent may have updated it
      const statusData = await this.taskManager.readStatus();
      const taskEntry = taskId !== null ? statusData.tasks.find((t) => t.id === taskId) : undefined;
      const effectiveTaskId = taskId ?? (statusData.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1);
      const title = taskEntry?.title ?? parseTaskTitle(nextTaskContent, effectiveTaskId);

      // Mark in-progress — preserve title/description if plan agent already wrote them
      await this.taskManager.setTaskStatus(
        effectiveTaskId,
        "inProgress",
        totalLLMCalls,
        settings.maxLLMCalls,
        taskEntry ? "" : title,
        taskEntry ? "" : parseTaskDescription(nextTaskContent)
      );
      await this.taskManager.setNextTaskContent(effectiveTaskId, nextTaskContent);

      // --- Dev + QA loop ---
      const devResult = await this.runDevQALoop(
        effectiveTaskId,
        title,
        nextTaskContent,
        totalLLMCalls,
      );
      totalLLMCalls = devResult.totalLLMCalls;
      tasksSincePlan++;
    }
  }

  private async runDevQALoop(
    effectiveTaskId: number,
    title: string,
    nextTaskContent: string,
    totalLLMCalls: number,
  ): Promise<{ totalLLMCalls: number }> {
    let feedback = "";
    await this.taskManager.setFeedbackContent(effectiveTaskId, "");
    let devIteration = 1;

    while (this.running && !feedback.includes("<status>verified</status>")) {
      const s = await this.settingsManager.read();
      if (totalLLMCalls >= s.maxLLMCalls) break;

      this.cb.onLog(
        `Dev iteration #${devIteration} for task #${effectiveTaskId}`
      );

      // Dev phase
      const devPrompt = await this.fileManager.read("dev-prompt.md");
      const fullDevPrompt = [devPrompt, nextTaskContent, feedback]
        .filter(Boolean)
        .join("\n\n");

      let devOutput: string;
      try {
        devOutput = await this.llmCaller.call(
          fullDevPrompt,
          s.devModel,
          this.repoRoot,
          {
            reasoningEffort: s.devReasoningEffort,
          }
        );
      } catch (err) {
        throw new Error(`Dev phase failed: ${err}`);
      }
      totalLLMCalls++;

      // Log a summary (first 200 chars)
      const summary = devOutput.slice(0, 200).replace(/\n/g, " ");
      this.cb.onLog(`[dev] ${summary}${devOutput.length > 200 ? "..." : ""}`);

      if (devOutput.includes("<status>blocked</status>")) {
        const blockedInfo = parseBlockedInfo(devOutput);
        const capturedAt = new Date().toISOString();
        await this.taskManager.setTaskStatus(
          effectiveTaskId,
          "blocked",
          totalLLMCalls,
          s.maxLLMCalls,
          "",
          "",
          devIteration,
          {
            summary: blockedInfo.summary,
            impact: blockedInfo.impact,
            nextStep: blockedInfo.nextStep,
            needs: blockedInfo.needs,
            capturedAt,
          }
        );
        this.cb.onLog(
          `Task #${effectiveTaskId} BLOCKED in iteration #${devIteration}`
        );
        break;
      }

      // Respect limits between dev and QA calls.
      if (totalLLMCalls >= s.maxLLMCalls) {
        this.cb.onLog(
          `[system] Max LLM calls reached (${totalLLMCalls}/${s.maxLLMCalls})`
        );
        break;
      }

      // QA phase
      await this.taskManager.setTaskStatus(
        effectiveTaskId,
        "inQa",
        totalLLMCalls,
        s.maxLLMCalls,
        "",
        "",
        devIteration
      );

      const qaPrompt = await this.fileManager.read("qa-prompt.md");
      const fullQAPrompt = [qaPrompt, nextTaskContent].join("\n\n");

      try {
        feedback = await this.llmCaller.call(
          fullQAPrompt,
          s.qaModel,
          this.repoRoot,
          {
            reasoningEffort: s.qaReasoningEffort,
          }
        );
      } catch (err) {
        throw new Error(`QA phase failed: ${err}`);
      }
      totalLLMCalls++;
      await this.taskManager.setFeedbackContent(effectiveTaskId, feedback);

      if (feedback.includes("<status>verified</status>")) {
        await this.taskManager.setTaskStatus(
          effectiveTaskId,
          "done",
          totalLLMCalls,
          s.maxLLMCalls,
          "",
          "",
          devIteration
        );
        this.cb.onLog(`Task #${effectiveTaskId} verified!`);
        await this.autoCommitTask(effectiveTaskId, title);
      } else {
        await this.taskManager.setTaskStatus(
          effectiveTaskId,
          "inProgress",
          totalLLMCalls,
          s.maxLLMCalls,
          "",
          "",
          devIteration
        );
        const fbSummary = feedback.slice(0, 120).replace(/\n/g, " ");
        this.cb.onLog(`[qa] Feedback: ${fbSummary}...`);
      }

      devIteration++;
      this.cb.onLog(`Total LLM calls: ${totalLLMCalls}/${s.maxLLMCalls}`);
    }

    return { totalLLMCalls };
  }

  private async autoCommitTask(taskNum: number, title: string): Promise<void> {
    const settings = await this.settingsManager.read();
    if (!settings.autoCommit) return;

    try {
      await this.gitManager.autoCommit(taskNum, title);
      this.cb.onLog(`[system] Committed: Task #${taskNum} - ${title}`);
    } catch (err) {
      this.cb.onLog(`[system] Auto-commit failed: ${err}`);
    }
  }

  async readSettings(): Promise<Settings> {
    return this.settingsManager.read();
  }

  async writeSettings(settings: Settings): Promise<void> {
    return this.settingsManager.write(settings);
  }

  async readStatusFile(): Promise<StatusData> {
    return this.taskManager.readStatus();
  }

  async readRalphFile(name: string): Promise<string> {
    return this.fileManager.read(name);
  }

  async writeRalphFile(name: string, content: string): Promise<void> {
    return this.fileManager.write(name, content);
  }

  async isEpicConfigured(): Promise<boolean> {
    try {
      const epic = await this.fileManager.read("epic.md");
      const normalized = epic.replace(/\r\n/g, "\n").trim();
      return normalized.length > 0 && normalized !== DEFAULT_EPIC_NORMALIZED;
    } catch {
      return false;
    }
  }

  private finishRun(runId: number, err?: Error): void {
    const wasStopped = this.stopRequestedRunId === runId;
    if (runId !== this.runGeneration) {
      return;
    }

    this.running = false;

    if (wasStopped) {
      return;
    }

    if (err) {
      this.cb.onLoopStatus("error", err.message);
      this.cb.onLog(`[system] Loop error: ${err.message}`);
      return;
    }

    this.cb.onLoopStatus("idle", null);
    this.cb.onLog("[system] Ralph loop finished");
  }

  private async waitForIdle(): Promise<void> {
    if (!this.activeRunPromise) {
      return;
    }

    try {
      await this.activeRunPromise;
    } catch {
      // start/restart should be able to continue after a failed or cancelled run
    }
  }
}

// --- Re-export types and parsing helpers for backward compatibility ---

export type { TaskEntry, StatusData } from "./task-manager.js";
export type { Settings } from "./settings-manager.js";
export {
  parseTaskId,
  parseTaskTitle,
  parseTaskDescription,
  parseRemainingTasks,
  parseJsonTaskList,
} from "./parse-output.js";
