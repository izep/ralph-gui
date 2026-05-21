import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import {
  PLAN_PROMPT,
  DEV_PROMPT,
  QA_PROMPT,
  MEMORY_MD,
  DEFAULT_EPIC,
} from "./templates.js";
import { TaskManager, type StatusData } from "./task-manager.js";
import { LLMCaller, type LLMCallOpts } from "./llm-caller.js";
import { copilotAgentUsesJsonlLog } from "../shared/copilotLogFormat.js";
import {
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
    this.llmCaller = new LLMCaller(() => this.running, (line) => this.cb.onLog(line));
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
      MEMORY_MD,
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
    const settings = await this.settingsManager.read();
    if (settings.requirementsFile) {
      try {
        await readFile(path.join(this.repoRoot, settings.requirementsFile), "utf-8");
        return settings.requirementsFile;
      } catch {
        return null;
      }
    }
    return this.gitManager.checkRequirements();
  }

  // --- Epic ---

  async readEpic(): Promise<string> {
    const settings = await this.settingsManager.read();
    const epicFile = settings.epicFile || "ralph/epic.md";
    try {
      return await readFile(path.join(this.repoRoot, epicFile), "utf-8");
    } catch {
      return "";
    }
  }

  async writeEpic(content: string): Promise<void> {
    const settings = await this.settingsManager.read();
    const epicFile = settings.epicFile || "ralph/epic.md";
    const epicPath = path.join(this.repoRoot, epicFile);
    await mkdir(path.dirname(epicPath), { recursive: true });
    await writeFile(epicPath, content, "utf-8");
  }

  // --- Start / Stop ---

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.running) return { ok: false, error: "Loop is already running" };

    await this.waitForIdle();

    const epicConfigured = await this.isEpicConfigured();
    if (!epicConfigured) {
      return {
        ok: false,
        error: "Epic is not configured. Fill out the epic file before starting the loop.",
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
    this.cb.onLog(`[ralph] Ralph loop started (requirements: ${reqFile})`);

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
    this.cb.onLog("[ralph] Ralph loop stopped by user");
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
    this.cb.onLog("[ralph] Refreshing backlog...");

    try {
      await this.bootstrap();
      const settings = await this.settingsManager.read();
      const planPrompt = await this.buildPrompt("plan-prompt.md", settings);
      const refreshInstruction = [
        "## Backlog Refresh Mode",
        "Refresh the task list only.",
        "Do not include <task-id>.",
        "Do not include implementation-ready task prose.",
      ].join("\n");
      const fullPlanPrompt = planPrompt + "---\n" + refreshInstruction;
      const output = await this.llmCaller.call(
        fullPlanPrompt,
        settings.planModel,
        this.repoRoot,
        this.llmOpts(settings, "plan"),
      );

      if (output.includes("<status>complete</status>")) {
        // Project complete — clear backlog
        const data = await this.taskManager.readStatus();
        data.tasks = data.tasks.filter((t) => t.status !== "backlog");
        await this.taskManager.writeStatus(data);
        this.cb.onLog("[ralph] Backlog refresh: project appears complete");
      } else {
        const parsedTasks = parseJsonTaskList(output);
        if (parsedTasks.length > 0) {
          await this.taskManager.syncBacklogTasks(parsedTasks);
          this.cb.onLog(`[ralph] Backlog refreshed: ${parsedTasks.length} tasks`);
        } else {
          const remainingTasks = parseRemainingTasks(output);
          if (remainingTasks.length > 0) {
            await this.taskManager.syncBacklogTasksByTitle(remainingTasks);
            this.cb.onLog(`[ralph] Backlog refreshed: ${remainingTasks.length} tasks`);
          } else {
            this.cb.onLog("[ralph] Backlog refresh: no tasks parsed from output");
          }
        }
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.cb.onLog(`[ralph] Backlog refresh failed: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      this.refreshing = false;
    }
  }

  // --- Timing helper ---

  private elapsed(startMs: number): string {
    const ms = Date.now() - startMs;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  }

  private llmOpts(
    settings: Settings,
    phase: "plan" | "dev" | "qa",
    reasoningEffort?: string,
  ): LLMCallOpts {
    return {
      agentBackend: settings.agentBackend,
      phase,
      copilotOutputFormat: settings.copilotOutputFormat,
      reasoningEffort,
    };
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

    // Smart resume: if a task was interrupted mid-dev or mid-QA, resume it
    const resumeTask = existingStatus.tasks.find(
      (t) => t.status === "inProgress" || t.status === "inQa"
    );
    if (resumeTask && this.running) {
      const isQa = resumeTask.status === "inQa";
      this.cb.onLog(
        `[ralph] Resuming ${isQa ? "QA" : "dev"} for task #${resumeTask.id}: ${resumeTask.title}`
      );
      const taskContent = `## Task: ${resumeTask.title}\n\n${resumeTask.description}`;
      await this.taskManager.setNextTaskContent(resumeTask.id, taskContent);
      const resumeResult = await this.runDevQALoop(
        resumeTask.id,
        resumeTask.title,
        taskContent,
        totalLLMCalls,
        isQa,
      );
      totalLLMCalls = resumeResult.totalLLMCalls;
      tasksSincePlan = 1;
    }

    while (this.running) {
      // Re-read settings each iteration to pick up control panel changes
      const settings = await this.settingsManager.read();
      if (totalLLMCalls >= settings.maxLLMCalls) {
        this.cb.onLog(
          `[ralph] Max LLM calls reached (${totalLLMCalls}/${settings.maxLLMCalls})`
        );
        break;
      }

      // Check if we should skip planning (use cached backlog instead)
      const currentStatus = await this.taskManager.readStatus();
      const backlogCount = currentStatus.tasks.filter((t) => t.status === "backlog").length;
      const shouldPlan =
        (iteration === 0 && backlogCount === 0) ||
        tasksSincePlan >= settings.planFrequency ||
        backlogCount < settings.minBacklogSize;

      iteration++;

      if (!shouldPlan && backlogCount > 0) {
        // Pick the first backlog task without re-planning
        const nextBacklog = currentStatus.tasks.find((t) => t.status === "backlog");
        if (nextBacklog) {
          this.cb.onLog(`[ralph] Skipping plan phase (${backlogCount} backlog tasks, plan every ${settings.planFrequency} tasks)`);
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

      this.cb.onLog(`[ralph] Planning iteration #${iteration}...`);
      tasksSincePlan = 0;

      // --- Plan phase ---
      const planPrompt = await this.buildPrompt("plan-prompt.md", settings);
      let nextTaskContent: string;
      const planStart = Date.now();
      try {
        nextTaskContent = await this.llmCaller.call(
          planPrompt,
          settings.planModel,
          this.repoRoot,
          this.llmOpts(settings, "plan"),
        );
      } catch (err) {
        throw new Error(`Plan phase failed: ${err}`);
      }
      totalLLMCalls++;
      this.cb.onLog(`[ralph] Planning iteration #${iteration} finished in ${this.elapsed(planStart)}`);

      // Check if all tasks are done
      if (nextTaskContent.includes("<status>complete</status>")) {
        this.cb.onLog(`[ralph] All tasks completed after ${iteration - 1} tasks.`);
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
        this.cb.onLog(`[ralph] Synced ${parsedTaskList.length} tasks from plan output (json)`);
      } else if (remainingTasks.length > 0) {
        await this.taskManager.syncBacklogTasksByTitle(remainingTasks);
        this.cb.onLog(`[ralph] Synced ${remainingTasks.length} tasks from plan output`);
      }

      // Re-read task-status.json and always pick the first backlog task.
      const statusData = await this.taskManager.readStatus();
      const taskEntry = statusData.tasks.find((t) => t.status === "backlog");

      if (!taskEntry) {
        this.cb.onLog("[ralph] Warning: no backlog task found after planning — skipping dev loop.");
        continue;
      }

      const effectiveTaskId = taskEntry.id;
      const title = taskEntry.title;
      const effectiveTaskContent = `## Task: ${taskEntry.title}\n\n${taskEntry.description}`;

      await this.taskManager.setTaskStatus(
        effectiveTaskId,
        "inProgress",
        totalLLMCalls,
        settings.maxLLMCalls,
      );
      await this.taskManager.setNextTaskContent(effectiveTaskId, effectiveTaskContent);

      // Pause after first planning phase if configured
      if (iteration === 1 && settings.pauseAfterPlan) {
        this.cb.onLog("[ralph] Paused after planning. Review the backlog and click Start to resume.");
        break;
      }

      // --- Dev + QA loop ---
      const devResult = await this.runDevQALoop(
        effectiveTaskId,
        title,
        effectiveTaskContent,
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
    startAtQa = false,
  ): Promise<{ totalLLMCalls: number }> {
    let feedback = "";
    if (startAtQa) {
      // Resuming interrupted QA — preserve any existing feedback so the QA
      // loop can continue from where it left off rather than starting fresh.
      const existingStatus = await this.taskManager.readStatus();
      if (existingStatus.feedback.taskId === effectiveTaskId) {
        feedback = existingStatus.feedback.content;
      }
    } else {
      await this.taskManager.setFeedbackContent(effectiveTaskId, "");
    }
    let devIteration = 1;

    while (this.running && !feedback.includes("<status>verified</status>")) {
      const s = await this.settingsManager.read();
      if (totalLLMCalls >= s.maxLLMCalls) break;

      this.cb.onLog(
        `[ralph] Dev iteration #${devIteration} for task #${effectiveTaskId}: ${title}`
      );

      if (!startAtQa) {
        // Dev phase
        const devPrompt = await this.buildPrompt("dev-prompt.md", s, { task: nextTaskContent, feedback });
        this.cb.onLog(`[dev] Running dev agent...`);
        const devStart = Date.now();
        let devOutput: string;
        try {
          devOutput = await this.llmCaller.call(
            devPrompt,
            s.devModel,
            this.repoRoot,
            this.llmOpts(s, "dev", s.devReasoningEffort),
          );
        } catch (err) {
          throw new Error(`Dev phase failed: ${err}`);
        }
        totalLLMCalls++;
        this.cb.onLog(`[dev] Dev agent finished in ${this.elapsed(devStart)}`);

        if (
          !copilotAgentUsesJsonlLog(s.agentBackend, s.copilotOutputFormat)
        ) {
          const summary = devOutput.slice(0, 200).replace(/\n/g, " ");
          this.cb.onLog(`[dev] ${summary}${devOutput.length > 200 ? "..." : ""}`);
        }

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
            `[ralph] Max LLM calls reached (${totalLLMCalls}/${s.maxLLMCalls})`
          );
          break;
        }
      }
      startAtQa = false;

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

      const qaPrompt = await this.buildPrompt("qa-prompt.md", s, { task: nextTaskContent });
      this.cb.onLog(`[qa] Running QA agent...`);
      const qaStart = Date.now();
      try {
        feedback = await this.llmCaller.call(
          qaPrompt,
          s.qaModel,
          this.repoRoot,
          this.llmOpts(s, "qa", s.qaReasoningEffort),
        );
      } catch (err) {
        throw new Error(`QA phase failed: ${err}`);
      }
      totalLLMCalls++;
      this.cb.onLog(`[qa] QA agent finished in ${this.elapsed(qaStart)}`);
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
        if (
          !copilotAgentUsesJsonlLog(s.agentBackend, s.copilotOutputFormat)
        ) {
          const fbSummary = feedback.slice(0, 120).replace(/\n/g, " ");
          this.cb.onLog(`[qa] Feedback: ${fbSummary}...`);
        }
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
      this.cb.onLog(`[ralph] Committed: Task #${taskNum} - ${title}`);
    } catch (err) {
      this.cb.onLog(`[ralph] Auto-commit failed: ${err}`);
    }
  }

  async readSettings(): Promise<Settings> {
    return this.settingsManager.read();
  }

  async writeSettings(settings: Settings): Promise<void> {
    return this.settingsManager.write(settings);
  }

  async resolveBlocker(taskId: number): Promise<void> {
    const status = await this.taskManager.readStatus();
    await this.taskManager.resolveBlocker(taskId, status.totalLLMCalls, status.maxLLMCalls);
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
      const epic = await this.readEpic();
      const normalized = epic.replace(/\r\n/g, "\n").trim();
      return normalized.length > 0 && normalized !== DEFAULT_EPIC_NORMALIZED;
    } catch {
      return false;
    }
  }

  private async buildPrompt(
    templateName: string,
    _settings: Settings,
    options?: { task?: string; feedback?: string }
  ): Promise<string> {
    const SEP = "\n---\n";
    const parts: string[] = [];

    // Requirements
    const reqFile = await this.checkRequirements();
    if (reqFile) {
      try {
        const reqContent = await readFile(path.join(this.repoRoot, reqFile), "utf-8");
        parts.push("Project Overview:\n" + reqContent);
      } catch { /* not readable — skip */ }
    }

    // Epic
    const epicContent = await this.readEpic();
    if (epicContent) parts.push("Current Epic:\n" + epicContent);

    // Task
    if (options?.task) parts.push("Current Task:\n" + options.task);

    // QA feedback
    if (options?.feedback) parts.push("QA Feedback:\n" + options.feedback);

    // Prompt template (already has its own heading)
    parts.push(await this.fileManager.read(templateName));

    return parts.join(SEP);
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
      this.cb.onLog(`[ralph] Loop error: ${err.message}`);
      return;
    }

    this.cb.onLoopStatus("idle", null);
    this.cb.onLog("[ralph] Ralph loop finished");
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
