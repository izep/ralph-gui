import type { ChildProcess } from "child_process";
import type { ReasoningEffort } from "../shared/agent-models.js";

export interface CopilotCallOpts {
  phase: "plan" | "dev" | "qa";
  model: string;
  reasoningEffort?: ReasoningEffort | "";
  outputFormat?: "text" | "json" | "streaming";
  mcpConfig?: string;
}

export interface ProviderHealthResult {
  ok: boolean;
  error?: string;
}

export interface ProviderRuntimeContext {
  prompt: string;
  repoRoot: string;
  command: string;
  isRunning: () => boolean;
  onLog?: (line: string) => void;
  setCurrentProcess: (proc: ChildProcess | null) => void;
  timeoutMs?: number;
  maxConsecutiveRepeats?: number;
  idleTimeoutMs?: number;
}
