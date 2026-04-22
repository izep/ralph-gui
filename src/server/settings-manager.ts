// Settings and repository configuration
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizeAgentBackend, type AgentBackendId } from "./llm-caller.js";

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
  agentBackend: AgentBackendId;
}

export const DEFAULT_SETTINGS: Settings = {
  maxLLMCalls: 100,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5-mini",
  qaModel: "gpt-5-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: false,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
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
