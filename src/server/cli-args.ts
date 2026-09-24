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

export const DEFAULT_LISTEN_PORT = 3001;

function parseListenPort(value: string, source: "--port" | "PORT"): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid ${source} "${value}". Expected an integer 1–65535.`);
  }
  return parsed;
}

/** CLI `--port` wins over `PORT`; default 3001. Throws on an invalid explicit value. */
export function resolveListenPort(cliValue?: string, envValue?: string): number {
  if (cliValue !== undefined) {
    return parseListenPort(cliValue, "--port");
  }
  if (envValue !== undefined && envValue !== "") {
    return parseListenPort(envValue, "PORT");
  }
  return DEFAULT_LISTEN_PORT;
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
    ...(getNumberArg("--agent-idle-timeout-minutes") !== undefined
      ? { agentIdleTimeoutMinutes: getNumberArg("--agent-idle-timeout-minutes")! }
      : {}),
    ...(getNumberArg("--agent-timeout-minutes") !== undefined
      ? { agentTimeoutMinutes: getNumberArg("--agent-timeout-minutes")! }
      : {}),
    ...(getBooleanArg("--auto-commit") !== undefined ? { autoCommit: getBooleanArg("--auto-commit")! } : {}),
    ...(agentBackendOverride ? { agentBackend: agentBackendOverride } : {}),
    ...(getBooleanArg("--fleet") !== undefined ? { fleetMode: getBooleanArg("--fleet")! } : {}),
    ...(getBooleanArg("--use-docker") !== undefined ? { useDocker: getBooleanArg("--use-docker")! } : {}),
    ...(getArg("--docker-compose") ? { dockerComposeFile: getArg("--docker-compose")! } : {}),
    ...(getArg("--docker-service") ? { dockerService: getArg("--docker-service")! } : {}),
  };

  await loop.writeSettings(next);
}
