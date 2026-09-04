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
import {
  normalizeCopilotOutputFormat,
  type CopilotOutputFormat,
} from "../shared/copilotLogFormat.js";

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
  /** Copilot CLI log format when agentBackend is copilot (JSONL + UI formatters). */
  copilotOutputFormat: CopilotOutputFormat;
  // Relative path to the epic file from the repo root (default: "ralph/epic.md")
  epicFile: string;
  // Relative path to the requirements file; empty string means auto-discover
  requirementsFile: string;
  pauseAfterPlan: boolean;
  taskColumnSort: TaskColumnSort;
  /** Per-agent-backend plan/dev/qa model IDs last saved for that platform */
  savedModelsByBackend: SavedModelsByBackend;
  /**
   * Kill a host Copilot CLI process that emits no stdout/stderr for this many minutes.
   * Heartbeats do not count as activity. `0` disables. Default 10.
   */
  agentIdleTimeoutMinutes: number;
  /**
   * Kill a host Copilot CLI process after this many minutes regardless of activity.
   * `0` disables.
   */
  agentTimeoutMinutes: number;
  /**
   * Kill a host Copilot CLI process if the same tool start repeats this many times.
   * `0` disables.
   */
  agentMaxConsecutiveRepeats: number;
}

export function timeoutMinutesToMs(minutes: number): number | undefined {
  if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
  return Math.floor(minutes) * 60_000;
}

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

export const DEFAULT_SETTINGS: Settings = {
  maxLLMCalls: 500,
  planModel: "claude-sonnet-5",
  devModel: "gpt-5.4-mini",
  qaModel: "gpt-5.4-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: true,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  fleetMode: true,
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
  copilotOutputFormat: "streaming",
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "updatedAtDesc",
  savedModelsByBackend: {},
  agentIdleTimeoutMinutes: 10,
  agentTimeoutMinutes: 0,
  agentMaxConsecutiveRepeats: 10,
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
        copilotOutputFormat: normalizeCopilotOutputFormat(parsed.copilotOutputFormat),
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
      merged.agentIdleTimeoutMinutes = normalizeNonNegativeInt(
        parsed.agentIdleTimeoutMinutes,
        DEFAULT_SETTINGS.agentIdleTimeoutMinutes,
      );
      merged.agentTimeoutMinutes = normalizeNonNegativeInt(
        parsed.agentTimeoutMinutes,
        DEFAULT_SETTINGS.agentTimeoutMinutes,
      );
      merged.agentMaxConsecutiveRepeats = normalizeNonNegativeInt(
        parsed.agentMaxConsecutiveRepeats,
        DEFAULT_SETTINGS.agentMaxConsecutiveRepeats,
      );

      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async write(settings: Settings): Promise<void> {
    const normalized = { ...DEFAULT_SETTINGS, ...settings };
    normalized.agentBackend = normalizeAgentBackend(settings.agentBackend);
    normalized.copilotOutputFormat = normalizeCopilotOutputFormat(
      settings.copilotOutputFormat,
    );
    normalized.agentIdleTimeoutMinutes = normalizeNonNegativeInt(
      settings.agentIdleTimeoutMinutes,
      DEFAULT_SETTINGS.agentIdleTimeoutMinutes,
    );
    normalized.agentTimeoutMinutes = normalizeNonNegativeInt(
      settings.agentTimeoutMinutes,
      DEFAULT_SETTINGS.agentTimeoutMinutes,
    );
    normalized.agentMaxConsecutiveRepeats = normalizeNonNegativeInt(
      settings.agentMaxConsecutiveRepeats,
      DEFAULT_SETTINGS.agentMaxConsecutiveRepeats,
    );
    await writeFile(
      path.join(this.ralphDir, "settings.json"),
      JSON.stringify(normalized, null, 2),
      "utf-8"
    );
  }
}
