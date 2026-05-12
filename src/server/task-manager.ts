// Task persistence and status management
import { readFile, writeFile } from "fs/promises";
import path from "path";

export interface TaskEntry {
  id: number;
  title: string;
  description: string;
  status: string;
  blocked?: {
    summary: string;
    impact: string;
    nextStep: string;
    needs: string;
    capturedAt: string;
    resolved?: boolean;
    resolvedAt?: string;
  };
  devIterations: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeStatus(status: string): string {
  if (status === "in-progress") return "inProgress";
  if (status === "in-qa") return "inQa";
  return status;
}

export interface StatusData {
  tasks: TaskEntry[];
  currentTaskNum: number;
  totalLLMCalls: number;
  maxLLMCalls: number;
  nextTask: {
    taskId: number | null;
    content: string;
    updatedAt: string;
  };
  feedback: {
    taskId: number | null;
    content: string;
    updatedAt: string;
  };
  lastUpdated: string;
}

export class TaskManager {
  private ralphDir: string;
  private onUpdated: ((data: StatusData) => void) | null;

  constructor(ralphDir: string, onUpdated?: (data: StatusData) => void) {
    this.ralphDir = ralphDir;
    this.onUpdated = onUpdated || null;
  }

  async readStatus(): Promise<StatusData> {
    const now = new Date().toISOString();
    try {
      const raw = await readFile(
        path.join(this.ralphDir, "task-status.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw) as Partial<StatusData>;
      const normalizedTasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t) => {
            const task = t as TaskEntry;
            return {
              ...task,
              status: normalizeStatus(task.status),
            };
          })
        : [];
      return {
        tasks: normalizedTasks,
        currentTaskNum: typeof parsed.currentTaskNum === "number" ? parsed.currentTaskNum : 0,
        totalLLMCalls: typeof parsed.totalLLMCalls === "number" ? parsed.totalLLMCalls : 0,
        maxLLMCalls: typeof parsed.maxLLMCalls === "number" ? parsed.maxLLMCalls : 100,
        nextTask: {
          taskId: parsed.nextTask && typeof parsed.nextTask.taskId === "number"
            ? parsed.nextTask.taskId
            : null,
          content: parsed.nextTask && typeof parsed.nextTask.content === "string"
            ? parsed.nextTask.content
            : "",
          updatedAt: parsed.nextTask && typeof parsed.nextTask.updatedAt === "string"
            ? parsed.nextTask.updatedAt
            : now,
        },
        feedback: {
          taskId: parsed.feedback && typeof parsed.feedback.taskId === "number"
            ? parsed.feedback.taskId
            : null,
          content: parsed.feedback && typeof parsed.feedback.content === "string"
            ? parsed.feedback.content
            : "",
          updatedAt: parsed.feedback && typeof parsed.feedback.updatedAt === "string"
            ? parsed.feedback.updatedAt
            : now,
        },
        lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : now,
      };
    } catch {
      return {
        tasks: [],
        currentTaskNum: 0,
        totalLLMCalls: 0,
        maxLLMCalls: 100,
        nextTask: {
          taskId: null,
          content: "",
          updatedAt: now,
        },
        feedback: {
          taskId: null,
          content: "",
          updatedAt: now,
        },
        lastUpdated: now,
      };
    }
  }

  async writeStatus(data: StatusData): Promise<void> {
    data.lastUpdated = new Date().toISOString();
    await writeFile(
      path.join(this.ralphDir, "task-status.json"),
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    if (this.onUpdated !== null) {
      this.onUpdated(data);
    }
  }

  async setTaskStatus(
    taskId: number,
    status: string,
    totalLLMCalls: number,
    maxLLMCalls: number,
    title = "",
    description = "",
    devIterations = 0,
    blocked: TaskEntry["blocked"] | null | undefined = undefined
  ): Promise<void> {
    const data = await this.readStatus();
    const now = new Date().toISOString();

    let found = false;
    for (const t of data.tasks) {
      if (t.id === taskId) {
        t.status = normalizeStatus(status);
        t.updatedAt = now;
        if (normalizeStatus(status) !== "blocked") {
          delete t.blocked;
        }
        if (blocked !== undefined) {
          if (blocked === null) {
            delete t.blocked;
          } else {
            t.blocked = blocked;
          }
        }
        if (devIterations > 0) t.devIterations = devIterations;
        if (title) t.title = title;
        if (description) t.description = description;
        found = true;
      }
    }

    if (!found) {
      data.tasks.push({
        id: taskId,
        title: title || `Task ${taskId}`,
        description: description || "",
        status: normalizeStatus(status),
        ...(blocked ? { blocked } : {}),
        devIterations,
        createdAt: now,
        updatedAt: now,
      });
    }

    data.currentTaskNum = taskId;
    data.totalLLMCalls = totalLLMCalls;
    data.maxLLMCalls = maxLLMCalls;
    await this.writeStatus(data);
  }

  async resolveBlocker(
    taskId: number,
    totalLLMCalls: number,
    maxLLMCalls: number
  ): Promise<void> {
    const data = await this.readStatus();
    const now = new Date().toISOString();

    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (task.status !== "blocked") {
      throw new Error(`Task ${taskId} is not blocked (status: ${task.status})`);
    }

    // Stamp resolution metadata before changing status
    if (task.blocked) {
      task.blocked.resolved = true;
      task.blocked.resolvedAt = now;
    }

    // Remove task from current position
    data.tasks = data.tasks.filter((t) => t.id !== taskId);

    // Find insertion point: right after the last backlog task
    let lastBacklogIdx = -1;
    for (let i = 0; i < data.tasks.length; i++) {
      if (data.tasks[i].status === "backlog") lastBacklogIdx = i;
    }

    task.status = "backlog";
    task.updatedAt = now;

    data.tasks.splice(lastBacklogIdx + 1, 0, task);
    data.totalLLMCalls = totalLLMCalls;
    data.maxLLMCalls = maxLLMCalls;
    await this.writeStatus(data);
  }

  async setNextTaskContent(taskId: number | null, content: string): Promise<void> {
    const data = await this.readStatus();
    data.nextTask = {
      taskId,
      content,
      updatedAt: new Date().toISOString(),
    };
    await this.writeStatus(data);
  }

  async setFeedbackContent(taskId: number | null, content: string): Promise<void> {
    const data = await this.readStatus();
    data.feedback = {
      taskId,
      content,
      updatedAt: new Date().toISOString(),
    };
    await this.writeStatus(data);
  }

  async syncBacklogTasks(
    incoming: Pick<TaskEntry, "id" | "title" | "description" | "status">[]
  ): Promise<void> {
    const data = await this.readStatus();
    const now = new Date().toISOString();

    // Quick lookups
    const existingById = new Map(data.tasks.map((t) => [t.id, t]));
    const existingNonBacklog = data.tasks.filter((t) => t.status !== "backlog");
    const incomingById = new Map(incoming.map((t) => [t.id, t]));

    // 1) Preserve non-backlog tasks in their original order, updating title/description if provided
    const preservedNonBacklog: TaskEntry[] = existingNonBacklog.map((t) => {
      const inc = incomingById.get(t.id);
      if (!inc) return t;
      return {
        ...t,
        title: inc.title,
        description: inc.description,
        // keep devIterations and createdAt; keep existing non-backlog status
        updatedAt: now,
      };
    });

    const preservedNonBacklogIds = new Set(preservedNonBacklog.map((t) => t.id));

    // 2) Build additional non-backlog entries (incoming items that should live in the non-backlog section)
    const additionalNonBacklog: TaskEntry[] = [];

    // 3) Build merged backlog in the order supplied by the caller (only backlog items)
    const mergedBacklog: TaskEntry[] = [];

    for (const src of incoming) {
      // If this incoming task already matched an existing non-backlog task, it's already applied above
      if (preservedNonBacklogIds.has(src.id)) continue;

      const existing = existingById.get(src.id);

      if (src.status !== "backlog") {
        // Should appear in the non-backlog section
        if (existing) {
          // existing was likely a backlog item being promoted to non-backlog; preserve audit fields
          const nextStatus = existing.status === "backlog" ? normalizeStatus(src.status) : normalizeStatus(existing.status);
          additionalNonBacklog.push({
            ...existing,
            title: src.title,
            description: src.description,
            status: nextStatus,
            updatedAt: now,
          });
        } else {
          // New non-backlog task
          additionalNonBacklog.push({
            id: src.id,
            title: src.title,
            description: src.description,
            status: normalizeStatus(src.status),
            devIterations: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        // Backlog item: include in merged backlog in incoming order
        if (existing) {
          const nextStatus = existing.status === "backlog" ? normalizeStatus(src.status) : normalizeStatus(existing.status);
          mergedBacklog.push({
            ...existing,
            title: src.title,
            description: src.description,
            status: nextStatus,
            updatedAt: now,
          });
        } else {
          mergedBacklog.push({
            id: src.id,
            title: src.title,
            description: src.description,
            status: src.status,
            devIterations: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Final ordering: preserved non-backlog (original order), then any additional non-backlog items (in incoming order), then backlog tasks (in incoming order)
    data.tasks = [...preservedNonBacklog, ...additionalNonBacklog, ...mergedBacklog];
    await this.writeStatus(data);
  }

  // Convenience wrapper for callers that only have title strings (legacy / string-based parsing).
  // Looks up existing task IDs by title to preserve continuity; assigns new IDs for unknown titles.
  async syncBacklogTasksByTitle(titles: string[]): Promise<void> {
    const data = await this.readStatus();
    const titleToId = new Map(data.tasks.map((t) => [t.title, t.id]));
    let maxId = data.tasks.reduce((m, t) => Math.max(m, t.id), 0);

    const incoming = titles.map((title) => {
      if (titleToId.has(title)) {
        return { id: titleToId.get(title)!, title, description: "", status: "backlog" as const };
      }
      return { id: ++maxId, title, description: "", status: "backlog" as const };
    });

    return this.syncBacklogTasks(incoming);
  }
}
