import { normalizeAgentBackend } from "./llm-caller.js";
import type { Settings } from "./settings-manager.js";

const args = process.argv.slice(2);

export function getArg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

export function hasFlag(name: string): boolean {
  return args.includes(name);
}

export function getBooleanArg(name: string): boolean | undefined {
  const value = getArg(name);
  if (value === undefined) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}

export function getNumberArg(name: string): number | undefined {
  const value = getArg(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function applyCliSettingsOverrides(loop: {
  readSettings(): Promise<Settings>;
  writeSettings(s: Settings): Promise<void>;
}): Promise<void> {
  const current = await loop.readSettings();

  const agentBackendArg = getArg("--agent-backend");
  const agentBackendOverride = agentBackendArg ? normalizeAgentBackend(agentBackendArg) : undefined;

  const next: Settings = {
    ...current,
    ...(getArg("--plan-model") ? { planModel: getArg("--plan-model")! } : {}),
    ...(getArg("--dev-model") ? { devModel: getArg("--dev-model")! } : {}),
    ...(getArg("--qa-model") ? { qaModel: getArg("--qa-model")! } : {}),
    ...(getArg("--dev-reasoning-effort") ? { devReasoningEffort: getArg("--dev-reasoning-effort")! } : {}),
    ...(getArg("--qa-reasoning-effort") ? { qaReasoningEffort: getArg("--qa-reasoning-effort")! } : {}),
    ...(getNumberArg("--max-llm-calls") !== undefined ? { maxLLMCalls: getNumberArg("--max-llm-calls")! } : {}),
    ...(getNumberArg("--plan-frequency") !== undefined ? { planFrequency: getNumberArg("--plan-frequency")! } : {}),
    ...(getNumberArg("--min-backlog-size") !== undefined ? { minBacklogSize: getNumberArg("--min-backlog-size")! } : {}),
    ...(getBooleanArg("--auto-commit") !== undefined ? { autoCommit: getBooleanArg("--auto-commit")! } : {}),
    ...(agentBackendOverride ? { agentBackend: agentBackendOverride } : {}),
    ...(getBooleanArg("--fleet") !== undefined ? { fleetMode: getBooleanArg("--fleet")! } : {}),
    ...(getBooleanArg("--use-docker") !== undefined ? { useDocker: getBooleanArg("--use-docker")! } : {}),
    ...(getArg("--docker-compose") ? { dockerComposeFile: getArg("--docker-compose")! } : {}),
    ...(getArg("--docker-service") ? { dockerService: getArg("--docker-service")! } : {}),
  };

  await loop.writeSettings(next);
}
