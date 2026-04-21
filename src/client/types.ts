export type TaskStatusValue =
  | "backlog"
  | "inProgress"
  | "inQa"
  | "done"
  | "blocked";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatusValue;
  blocked?: {
    summary: string;
    impact: string;
    nextStep: string;
    needs: string;
    capturedAt: string;
  };
  devIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatusData {
  tasks: Task[];
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

export interface ColumnDef {
  key: TaskStatusValue;
  label: string;
  color: string;
  emptyMessage: string;
}

export interface LoopStatus {
  status: "idle" | "running" | "error" | "stopped";
  error: string | null;
}

export interface Settings {
  maxLLMCalls: number;
  planModel: string;
  devModel: string;
  qaModel: string;
  devReasoningEffort: string;
  qaReasoningEffort: string;
  autoCommit: boolean;
  planFrequency: number;
  minBacklogSize: number;
  // Supported values: "copilot" | "cursor-agent" | "claude" | "gemini"
  agentBackend: string;
}

export interface Readiness {
  repoConfigured: boolean;
  requirementsFound: boolean;
  requirementsFile: string | null;
  gitBranch: string;
  epicConfigured: boolean;
}

export type ServerMessage =
  | { type: "init"; data: { tasks: TaskStatusData; loopStatus: LoopStatus; settings: Settings; epic: string; prompts: Record<string, string>; log: string[]; repoRoot: string; readiness: Readiness } }
  | { type: "tasks"; data: TaskStatusData }
  | { type: "log"; data: string }
  | { type: "loopStatus"; data: LoopStatus }
  | { type: "settings"; data: Settings }
  | { type: "readiness"; data: Readiness };

export function groupTasks(tasks: Task[]): Record<TaskStatusValue, Task[]> {
  const groups: Record<TaskStatusValue, Task[]> = {
    "backlog": [],
    inProgress: [],
    inQa: [],
    "done": [],
    "blocked": [],
  };
  for (const task of tasks) {
    if (task.status === "blocked") {
      groups.inProgress.push(task);
    } else if (groups[task.status]) {
      groups[task.status].push(task);
    }
  }
  return groups;
}

export const COLUMNS: ColumnDef[] = [
  {
    key: "backlog",
    label: "Backlog",
    color: "#6b7280",
    emptyMessage: "Tasks appear here as they are planned",
  },
  {
    key: "inProgress",
    label: "In Progress",
    color: "#3b82f6",
    emptyMessage: "No tasks in development",
  },
  {
    key: "inQa",
    label: "In QA",
    color: "#f59e0b",
    emptyMessage: "No tasks under review",
  },
  {
    key: "done",
    label: "Done",
    color: "#10b981",
    emptyMessage: "No tasks completed yet",
  },
];
