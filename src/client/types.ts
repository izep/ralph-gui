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
    resolved?: boolean;
    resolvedAt?: string;
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

export type AgentBackendId = "copilot" | "cursor-agent" | "claude" | "gemini" | "opencode";

export type TaskColumnSort =
  | "updatedAtAsc"
  | "updatedAtDesc"
  | "idAsc"
  | "idDesc";

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
  agentBackend: AgentBackendId;
  fleetMode: boolean;
  useDocker: boolean;
  dockerComposeFile: string;
  dockerService: string;
  epicBaseBranch: string;
  dockerWorkBranch: string;
  dockerIsolateBranch: boolean;
  dockerPoolSize: number;
  dockerParallelTasks: boolean;
  /** Dispatch parallel research sub-jobs during the plan phase (stretch) */
  dockerPlanParallel: boolean;
  dockerInstalledBackends: AgentBackendId[];
  dockerMountSocket: boolean;
  /** Auto-merge dockerWorkBranch into epicBaseBranch when loop finishes successfully */
  dockerAutoMergeEpicWork: boolean;
  epicFile: string;
  requirementsFile: string;
  pauseAfterPlan: boolean;
  taskColumnSort: TaskColumnSort;
  savedModelsByBackend: Partial<
    Record<AgentBackendId, { planModel: string; devModel: string; qaModel: string }>
  >;
}

export interface Readiness {
  repoConfigured: boolean;
  requirementsFound: boolean;
  requirementsFile: string | null;
  gitBranch: string;
  epicConfigured: boolean;
  dockerHostOk?: boolean;
  dockerHostError?: string;
}

export type ServerMessage =
  | { type: "init"; data: { tasks: TaskStatusData; loopStatus: LoopStatus; settings: Settings; epic: string; prompts: Record<string, string>; log: string[]; repoRoot: string; readiness: Readiness } }
  | { type: "tasks"; data: TaskStatusData }
  | { type: "log"; data: string }
  | { type: "loopStatus"; data: LoopStatus }
  | { type: "settings"; data: Settings }
  | { type: "readiness"; data: Readiness }
  | { type: "epic"; data: string };

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

export function sortTasks(tasks: Task[], taskColumnSort: TaskColumnSort): Task[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (taskColumnSort) {
      case "updatedAtAsc": {
        const c = a.updatedAt.localeCompare(b.updatedAt);
        return c !== 0 ? c : a.id - b.id;
      }
      case "updatedAtDesc": {
        const c = b.updatedAt.localeCompare(a.updatedAt);
        return c !== 0 ? c : b.id - a.id;
      }
      case "idAsc":
        return a.id - b.id;
      case "idDesc":
        return b.id - a.id;
      default: {
        const _exhaustive: never = taskColumnSort;
        return _exhaustive;
      }
    }
  });
  return sorted;
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
