// LLM CLI invocation supporting copilot, cursor-agent, claude, gemini, and opencode backends
import { spawn, type ChildProcess } from "child_process";
import { constants } from "fs";
import { access } from "fs/promises";
import path from "path";
import {
  buildDockerSpawn,
  resolveAgentCliInDockerContainer,
  resolveComposeFile,
} from "./docker-runner.js";
import type { Settings } from "./settings-manager.js";
import { runCopilotCall } from "./copilot-cli.js";

export const AGENT_BACKENDS = ["copilot", "cursor-agent", "claude", "gemini", "opencode"] as const;
export type AgentBackendId = (typeof AGENT_BACKENDS)[number];

export const FLEET_CAPABLE_BACKENDS = ["copilot"] as const satisfies readonly AgentBackendId[];

export function backendSupportsFleetMode(backend: AgentBackendId): boolean {
  return (FLEET_CAPABLE_BACKENDS as readonly string[]).includes(backend);
}

export function effectiveFleetMode(fleetMode: boolean, backend: AgentBackendId): boolean {
  return fleetMode && backendSupportsFleetMode(backend);
}

export function applyCopilotFleetPrefix(prompt: string, enabled: boolean): string {
  if (!enabled) return prompt;
  if (prompt.trimStart().startsWith("/fleet")) return prompt;
  return `/fleet\n\n${prompt}`;
}

export interface LLMCallOpts {
  agentBackend?: AgentBackendId;
  reasoningEffort?: string;
  fleetMode?: boolean;
  useDocker?: boolean;
  dockerComposeFile?: string;
  dockerService?: string;
  repoRoot?: string;
  /** When useDocker is true, exec into this specific container index (--index N). */
  dockerContainerIndex?: number;
  /** When useDocker is true, use this container working directory instead of /workspace. */
  dockerWorktreeCwd?: string;
  /** Stream CLI stdout/stderr lines to the Ralph log (e.g. docker agent output). */
  onProgress?: (line: string, stream: "stdout" | "stderr") => void;
  /** Log tag phase when using Copilot JSONL (`[copilot:plan|dev|qa]`). */
  phase?: "plan" | "dev" | "qa";
  copilotOutputFormat?: "text" | "json" | "streaming";
  mcpConfig?: string;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  maxConsecutiveRepeats?: number;
}

/** @deprecated Use LLMCallOpts instead */
export type CopilotOpts = LLMCallOpts;

export function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  if (v === "opencode") return "opencode";
  return "copilot";
}

export function backendSupportsReasoningEffort(backend: AgentBackendId): boolean {
  return backend === "copilot" || backend === "claude";
}

function getAgentBackendOverrideFromEnv(): AgentBackendId | null {
  const override = process.env.RALPH_AGENT_BACKEND_OVERRIDE?.trim();
  if (!override) {
    return null;
  }

  return normalizeAgentBackend(override);
}

function effectiveAgentBackend(opts: CopilotOpts): AgentBackendId {
  return getAgentBackendOverrideFromEnv() ?? normalizeAgentBackend(opts.agentBackend);
}

/** Avoid argv parsing treating the prompt as a flag when it starts with "-". */
export function normalizePromptForArgv(prompt: string): string {
  if (prompt.startsWith("-")) {
    return `\n${prompt}`;
  }
  return prompt;
}

function getWindowsExecutableExtensions(pathext?: string): string[] {
  const configured = (pathext ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([".cmd", ".bat", ".exe", ...configured]));
}

function getCommandCandidates(command: string, platform: NodeJS.Platform, pathext?: string): string[] {
  if (platform !== "win32") {
    return [command];
  }

  if (path.extname(command)) {
    return [command];
  }

  return [...getWindowsExecutableExtensions(pathext).map((extension) => `${command}${extension}`), command];
}

function isDirectPath(command: string): boolean {
  return path.isAbsolute(command) || command.includes("/") || command.includes("\\");
}

async function isLaunchable(filePath: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    await access(filePath, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandPath(
  command: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): Promise<string | null> {
  const candidates = getCommandCandidates(command, platform, env.PATHEXT);

  if (isDirectPath(command)) {
    for (const candidate of candidates) {
      if (await isLaunchable(candidate, platform)) {
        return candidate;
      }
    }
    return null;
  }

  const pathEntries = (env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const directory of pathEntries) {
    for (const candidate of candidates) {
      const fullPath = path.join(directory, candidate);
      if (await isLaunchable(fullPath, platform)) {
        return fullPath;
      }
    }
  }

  return null;
}

async function resolveFirstExecutable(
  candidates: string[],
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  notFoundMessage: string,
): Promise<string> {
  for (const candidate of candidates) {
    const resolved = await resolveCommandPath(candidate.trim(), env, platform);
    if (resolved) {
      return resolved;
    }
  }
  throw new Error(notFoundMessage);
}

export async function resolveCopilotCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const configuredCommand = env.COPILOT_BIN?.trim();
  const candidates = configuredCommand
    ? [configuredCommand]
    : platform === "win32"
      ? ["copilot", "copilot.cmd", "copilot.bat", "copilot.exe"]
      : ["copilot"];

  return resolveFirstExecutable(
    candidates,
    env,
    platform,
    "Copilot CLI not found in PATH. Install GitHub Copilot CLI so `copilot` is available, or set COPILOT_BIN to the executable path.",
  );
}

export async function resolveCursorAgentCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const configuredCommand = env.CURSOR_AGENT_BIN?.trim();
  const candidates = configuredCommand
    ? [configuredCommand]
    : platform === "win32"
      ? ["cursor-agent", "cursor-agent.cmd", "cursor-agent.bat", "cursor-agent.exe"]
      : ["cursor-agent"];

  return resolveFirstExecutable(
    candidates,
    env,
    platform,
    "cursor-agent not found in PATH. Install the Cursor CLI so `cursor-agent` is available, or set CURSOR_AGENT_BIN to the executable path.",
  );
}

export async function resolveClaudeCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const configuredCommand = env.CLAUDE_BIN?.trim();
  const candidates = configuredCommand
    ? [configuredCommand]
    : platform === "win32"
      ? ["claude", "claude.cmd", "claude.bat", "claude.exe"]
      : ["claude"];

  return resolveFirstExecutable(
    candidates,
    env,
    platform,
    "Claude Code CLI not found in PATH. Install Claude Code so `claude` is available, or set CLAUDE_BIN to the executable path.",
  );
}

export async function resolveGeminiCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const configuredCommand = env.GEMINI_BIN?.trim();
  const candidates = configuredCommand
    ? [configuredCommand]
    : platform === "win32"
      ? ["gemini", "gemini.cmd", "gemini.bat", "gemini.exe"]
      : ["gemini"];

  return resolveFirstExecutable(
    candidates,
    env,
    platform,
    "Gemini CLI not found in PATH. Install Google Gemini CLI so `gemini` is available, or set GEMINI_BIN to the executable path.",
  );
}

export async function resolveOpencodeCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const configuredCommand = env.OPENCODE_BIN?.trim();
  const candidates = configuredCommand
    ? [configuredCommand]
    : platform === "win32"
      ? ["opencode", "opencode.cmd", "opencode.bat", "opencode.exe"]
      : ["opencode"];

  return resolveFirstExecutable(
    candidates,
    env,
    platform,
    "OpenCode CLI not found in PATH. Install OpenCode so `opencode` is available, or set OPENCODE_BIN to the executable path.",
  );
}

export function shouldUseShellForCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== "win32") {
    return false;
  }

  const extension = path.extname(command).toLowerCase();
  return extension === ".cmd" || extension === ".bat";
}

function backendCliLabel(backend: AgentBackendId): string {
  switch (backend) {
    case "cursor-agent":
      return "cursor-agent";
    case "claude":
      return "claude";
    case "gemini":
      return "gemini";
    case "opencode":
      return "opencode";
    default:
      return "copilot";
  }
}

const ARG_PROMPT_MAX_CHARS = 16_000;
const CURSOR_AGENT_NON_INTERACTIVE_FLAGS = ["--yolo"] as const;
const CLAUDE_NON_INTERACTIVE_FLAGS = ["--permission-mode", "bypassPermissions"] as const;
const GEMINI_NON_INTERACTIVE_FLAGS = ["--yolo"] as const;
const OPENCODE_NON_INTERACTIVE_FLAGS = ["--dangerously-skip-permissions"] as const;

function assertPromptFitsArgv(prompt: string, backend: AgentBackendId): void {
  if (prompt.length <= ARG_PROMPT_MAX_CHARS) {
    return;
  }

  throw new Error(
    `Prompt too large to pass via argv for ${backendCliLabel(backend)} (${prompt.length} chars > ${ARG_PROMPT_MAX_CHARS}).`,
  );
}


async function resolveCommandForBackend(
  backend: AgentBackendId,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): Promise<string> {
  switch (backend) {
    case "cursor-agent":
      return resolveCursorAgentCommand(env, platform);
    case "claude":
      return resolveClaudeCommand(env, platform);
    case "gemini":
      return resolveGeminiCommand(env, platform);
    case "opencode":
      return resolveOpencodeCommand(env, platform);
    default:
      return resolveCopilotCommand(env, platform);
  }
}

export class LLMCaller {
  private isRunning: () => boolean;
  private onLog?: (line: string) => void;
  /** Keyed by slotKey: `docker:<containerIndex>` for Docker calls, `main` otherwise. */
  private activeProcesses = new Map<string, ChildProcess>();
  private killTimer: NodeJS.Timeout | null = null;
  /** Resolved executable path per backend id (host) or `docker:<backend>` (container). */
  private cachedCommands = new Map<string, string>();

  constructor(isRunning: () => boolean, onLog?: (line: string) => void) {
    this.isRunning = isRunning;
    this.onLog = onLog;
  }

  clearCommandCache(): void {
    this.cachedCommands.clear();
  }

  call(
    prompt: string,
    model: string,
    repoRoot: string,
    opts: CopilotOpts
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      void (async () => {
        if (!this.isRunning()) {
          reject(new Error("Loop was stopped"));
          return;
        }

        const backend = effectiveAgentBackend(opts);
        const useFleet = effectiveFleetMode(opts.fleetMode ?? false, backend);
        const useDocker = !!opts.useDocker;
        const cacheKey = useDocker ? `docker:${backend}` : backend;

        let cached = this.cachedCommands.get(cacheKey);
        if (!cached) {
          if (useDocker) {
            const dummySettings: Pick<Settings, "dockerComposeFile"> = {
              dockerComposeFile: opts.dockerComposeFile ?? "",
            };
            const composeFile = resolveComposeFile(dummySettings, repoRoot);
            const service = opts.dockerService ?? "ralph-agent";
            cached = await resolveAgentCliInDockerContainer(
              composeFile,
              service,
              repoRoot,
              backend,
            );
          } else {
            cached = await resolveCommandForBackend(backend, process.env, process.platform);
          }
          this.cachedCommands.set(cacheKey, cached);
        }
        const command = cached;

        if (!this.isRunning()) {
          reject(new Error("Loop was stopped"));
          return;
        }

        const cli = backendCliLabel(backend);
        const reasoningEffort = backendSupportsReasoningEffort(backend) ? opts.reasoningEffort : undefined;

        if (backend === "copilot" && !useDocker) {
          const output = await runCopilotCall(
            {
              phase: opts.phase ?? "dev",
              model,
              reasoningEffort,
              outputFormat: opts.copilotOutputFormat ?? "streaming",
              mcpConfig: opts.mcpConfig,
            },
            {
              prompt: applyCopilotFleetPrefix(prompt, useFleet),
              repoRoot,
              command,
              isRunning: this.isRunning,
              onLog: this.onLog,
              setCurrentProcess: (proc) => {
                if (proc) {
                  this.activeProcesses.set("main", proc);
                } else {
                  this.activeProcesses.delete("main");
                  if (this.activeProcesses.size === 0) {
                    this.clearKillTimer();
                  }
                }
              },
              timeoutMs: opts.timeoutMs,
              idleTimeoutMs: opts.idleTimeoutMs,
              maxConsecutiveRepeats: opts.maxConsecutiveRepeats,
            },
          );
          resolve(output);
          return;
        }

        let args: string[];
        let writeStdin: string | null;

        switch (backend) {
          case "copilot": {
            // Docker containers don't yet support the streaming/JSONL copilot path handled above.
            args = ["--model", model, "--autopilot", "-s", "--yolo", "--no-color"];
            if (reasoningEffort) {
              args.push("--reasoning-effort", reasoningEffort);
            }
            writeStdin = applyCopilotFleetPrefix(prompt, useFleet);
            break;
          }
          case "cursor-agent": {
            if (prompt.length <= ARG_PROMPT_MAX_CHARS) {
              args = [
                "-p",
                normalizePromptForArgv(prompt),
                "--model",
                model,
                ...CURSOR_AGENT_NON_INTERACTIVE_FLAGS,
                "--output-format",
                "text",
              ];
              writeStdin = null;
            } else {
              // Large prompts exceed argv limits; cursor-agent reads the prompt from stdin with --print.
              args = [
                "--print",
                "--model",
                model,
                ...CURSOR_AGENT_NON_INTERACTIVE_FLAGS,
                "--output-format",
                "text",
              ];
              writeStdin = prompt;
            }
            break;
          }
          case "claude": {
            if (prompt.length <= ARG_PROMPT_MAX_CHARS) {
              args = [
                "-p",
                normalizePromptForArgv(prompt),
                "--model",
                model,
                ...CLAUDE_NON_INTERACTIVE_FLAGS,
                "--output-format",
                "text",
              ];
              writeStdin = null;
            } else {
              // Large prompts exceed argv limits; claude reads the prompt from stdin
              // when -p is passed without an inline argument.
              args = [
                "-p",
                "--model",
                model,
                ...CLAUDE_NON_INTERACTIVE_FLAGS,
                "--output-format",
                "text",
              ];
              writeStdin = prompt;
            }
            if (reasoningEffort) {
              args.push("--effort", reasoningEffort);
            }
            break;
          }
          case "gemini": {
            assertPromptFitsArgv(prompt, backend);
            args = [
              "-p",
              normalizePromptForArgv(prompt),
              "-m",
              model,
              ...GEMINI_NON_INTERACTIVE_FLAGS,
              "--output-format",
              "text",
            ];
            writeStdin = null;
            break;
          }
          case "opencode": {
            args = [
              "run",
              "-m",
              model,
              ...OPENCODE_NON_INTERACTIVE_FLAGS,
              "--format",
              "default",
            ];
            writeStdin = prompt;
            break;
          }
        }

        let spawnCmd: string;
        let spawnArgs: string[];
        let spawnCwd: string;

        if (useDocker) {
          const dummySettings: Pick<Settings, "dockerComposeFile"> = {
            dockerComposeFile: opts.dockerComposeFile ?? "",
          };
          const composeFile = resolveComposeFile(dummySettings, repoRoot);
          const service = opts.dockerService ?? "ralph-agent";
          const spec = buildDockerSpawn(composeFile, service, command, args, {
            containerIndex: opts.dockerContainerIndex,
            worktreeCwd: opts.dockerWorktreeCwd,
          });
          spawnCmd = spec.cmd;
          spawnArgs = spec.args;
          spawnCwd = repoRoot;
        } else {
          spawnCmd = command;
          spawnArgs = args;
          spawnCwd = repoRoot;
        }

        const proc = spawn(spawnCmd, spawnArgs, {
          cwd: spawnCwd,
          shell: opts.useDocker ? false : shouldUseShellForCommand(command),
          stdio: ["pipe", "pipe", "pipe"],
          env: opts.useDocker
            ? { ...process.env, RALPH_REPO_ROOT: repoRoot }
            : process.env,
        });

        // Track by slot key so parallel Docker calls coexist without clobbering each other.
        const slotKey =
          useDocker && opts.dockerContainerIndex != null
            ? `docker:${opts.dockerContainerIndex}`
            : "main";
        this.activeProcesses.set(slotKey, proc);

        let stdout = "";
        let stderr = "";
        const stdoutBuf = { partial: "" };
        const stderrBuf = { partial: "" };

        const flushProgress = (
          buffer: { partial: string },
          stream: "stdout" | "stderr",
          final = false,
        ) => {
          if (!opts.onProgress) return;
          if (final && buffer.partial.trim()) {
            opts.onProgress(buffer.partial.trimEnd(), stream);
            buffer.partial = "";
            return;
          }
          const parts = buffer.partial.split(/\r?\n/);
          buffer.partial = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trimEnd();
            if (trimmed) opts.onProgress(trimmed, stream);
          }
        };

        proc.stdout.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          if (opts.onProgress) {
            stdoutBuf.partial += chunk;
            flushProgress(stdoutBuf, "stdout");
          }
        });
        proc.stderr.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          if (opts.onProgress) {
            stderrBuf.partial += chunk;
            flushProgress(stderrBuf, "stderr");
          }
        });

        if (writeStdin !== null) {
          proc.stdin.write(writeStdin);
        }
        proc.stdin.end();

        proc.on("close", (code) => {
          if (opts.onProgress) {
            flushProgress(stdoutBuf, "stdout", true);
            flushProgress(stderrBuf, "stderr", true);
          }
          if (this.activeProcesses.get(slotKey) === proc) {
            this.activeProcesses.delete(slotKey);
          }
          if (this.activeProcesses.size === 0) {
            this.clearKillTimer();
          }
          if (!this.isRunning()) {
            reject(new Error("Loop was stopped"));
          } else if (code !== 0) {
            const hint =
              code === 127 && useDocker
                ? ` (command not found in container — rebuild after installing the ${cli} CLI; see docker/README.md)`
                : "";
            reject(
              new Error(
                `${cli} exited with code ${code}${hint}${stderr ? ": " + stderr.slice(0, 300) : ""}`,
              ),
            );
          } else {
            resolve(stdout);
          }
        });

        proc.on("error", (err) => {
          if (this.activeProcesses.get(slotKey) === proc) {
            this.activeProcesses.delete(slotKey);
          }
          this.clearKillTimer();
          reject(new Error(`Failed to run ${cli}: ${err.message}`));
        });
      })().catch((err: Error) => {
        const backend = effectiveAgentBackend(opts);
        reject(new Error(`Failed to run ${backendCliLabel(backend)}: ${err.message}`));
      });
    });
  }

  stop(): void {
    if (this.activeProcesses.size > 0) {
      const procs = [...this.activeProcesses.values()];
      this.activeProcesses.clear();
      for (const proc of procs) {
        proc.kill("SIGTERM");
      }
      this.clearKillTimer();
      this.killTimer = setTimeout(() => {
        for (const proc of procs) {
          try {
            proc.kill("SIGKILL");
          } catch {
            // process may have already exited
          }
        }
      }, 5000);
      this.killTimer.unref?.();
    }
  }

  private clearKillTimer(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
  }
}
