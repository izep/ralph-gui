// Settings and repository configuration
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizeAgentBackend, type AgentBackendId } from "./llm-caller.js";
import { normalizeSettingsModels, type SavedModelsByBackend } from "../shared/agent-models.js";
import {
  DEFAULT_DOCKER_MERGE_STRATEGY,
  normalizeDockerMergeStrategy,
  type DockerMergeStrategy,
} from "../shared/docker-merge-strategy.js";

export type { DockerMergeStrategy };

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
  // Supported values: "copilot" | "cursor-agent" | "claude" | "gemini" | "opencode"
  agentBackend: AgentBackendId;
  // Enable fleet mode (persisted even if backend is not fleet-capable; UI grays it out)
  fleetMode: boolean;
  // Docker agent execution
  useDocker: boolean;
  dockerComposeFile: string;
  dockerService: string;
  // Git branch metadata captured at loop start when useDocker is true
  epicBaseBranch: string;
  dockerWorkBranch: string;
  dockerIsolateBranch: boolean;
  /** work-branch: stage on ralph/epic-* then merge at loop end; epic-base-per-task: merge each task into epic base */
  dockerMergeStrategy: DockerMergeStrategy;
  // Container pool — parallel dev/QA tasks in separate containers
  dockerPoolSize: number;
  dockerParallelTasks: boolean;
  /** (Stretch) Dispatch parallel research sub-jobs during the plan phase */
  dockerPlanParallel: boolean;
  dockerInstalledBackends: AgentBackendId[];
  // Socket mount — allow agents to run docker compose inside the container
  dockerMountSocket: boolean;
  /** Auto-merge dockerWorkBranch into epicBaseBranch when loop finishes successfully */
  dockerAutoMergeEpicWork: boolean;
  // Relative path to the epic file from the repo root (default: "ralph/epic.md")
  epicFile: string;
  // Relative path to the requirements file; empty string means auto-discover
  requirementsFile: string;
  pauseAfterPlan: boolean;
  taskColumnSort: TaskColumnSort;
  /** Per-agent-backend plan/dev/qa model IDs last saved for that platform */
  savedModelsByBackend: SavedModelsByBackend;
}

export const DEFAULT_SETTINGS: Settings = {
  maxLLMCalls: 100,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5.4-mini",
  qaModel: "gpt-5.4-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: false,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  fleetMode: false,
  useDocker: false,
  dockerComposeFile: "",
  dockerService: "ralph-agent",
  epicBaseBranch: "",
  dockerWorkBranch: "",
  dockerIsolateBranch: true,
  dockerMergeStrategy: DEFAULT_DOCKER_MERGE_STRATEGY,
  dockerPoolSize: 1,
  dockerParallelTasks: false,
  dockerPlanParallel: false,
  dockerInstalledBackends: [],
  dockerMountSocket: false,
  dockerAutoMergeEpicWork: true,
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "idAsc",
  savedModelsByBackend: {},
};

export class SettingsManager {
  private ralphDir: string;

  constructor(ralphDir: string) {
    this.ralphDir = ralphDir;
  }

  async read(): Promise<Settings> {
    try {
      const raw = await readFile(
        path.join(this.ralphDir, "settings.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw) as Partial<Omit<Settings, "agentBackend">> & {
        agentBackend?: string;
        reasoningEffort?: string;
      };
      const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        agentBackend: normalizeAgentBackend(parsed.agentBackend),
      };

      // Backward compatibility for older settings.json files.
      if (!parsed.devReasoningEffort && parsed.reasoningEffort) {
        merged.devReasoningEffort = parsed.reasoningEffort;
      }
      if (!parsed.qaReasoningEffort) {
        merged.qaReasoningEffort = merged.devReasoningEffort;
      }
      if (!parsed.qaModel) {
        merged.qaModel = merged.devModel;
      }
      if (!parsed.savedModelsByBackend || typeof parsed.savedModelsByBackend !== "object") {
        merged.savedModelsByBackend = {};
      }

      const normalizedModels = normalizeSettingsModels(
        merged.agentBackend,
        merged.planModel,
        merged.devModel,
        merged.qaModel,
        merged.savedModelsByBackend,
      );
      merged.planModel = normalizedModels.planModel;
      merged.devModel = normalizedModels.devModel;
      merged.qaModel = normalizedModels.qaModel;
      merged.savedModelsByBackend = normalizedModels.savedModelsByBackend;
      merged.dockerMergeStrategy = normalizeDockerMergeStrategy(parsed.dockerMergeStrategy);

      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async write(settings: Settings): Promise<void> {
    const normalized = { ...DEFAULT_SETTINGS, ...settings };
    normalized.agentBackend = normalizeAgentBackend(settings.agentBackend);
    await writeFile(
      path.join(this.ralphDir, "settings.json"),
      JSON.stringify(normalized, null, 2),
      "utf-8"
    );
  }
}
