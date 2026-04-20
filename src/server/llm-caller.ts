// LLM CLI invocation supporting copilot, cursor-agent, claude, and gemini backends
import { spawn, type ChildProcess } from "child_process";
import { constants } from "fs";
import { access } from "fs/promises";
import path from "path";

export type AgentBackendId = "copilot" | "cursor-agent" | "claude" | "gemini";

export interface LLMCallOpts {
  agentBackend?: string;
  reasoningEffort?: string;
}

/** @deprecated Use LLMCallOpts instead */
export type CopilotOpts = LLMCallOpts;

export function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  return "copilot";
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
    default:
      return "copilot";
  }
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
    default:
      return resolveCopilotCommand(env, platform);
  }
}

export class LLMCaller {
  private isRunning: () => boolean;
  private currentProcess: ChildProcess | null = null;
  private killTimer: NodeJS.Timeout | null = null;
  /** Resolved executable path per backend id */
  private cachedCommands = new Map<AgentBackendId, string>();

  constructor(isRunning: () => boolean) {
    this.isRunning = isRunning;
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

        const backend = normalizeAgentBackend(opts.agentBackend);
        let cached = this.cachedCommands.get(backend);
        if (!cached) {
          cached = await resolveCommandForBackend(backend, process.env, process.platform);
          this.cachedCommands.set(backend, cached);
        }
        const command = cached;

        if (!this.isRunning()) {
          reject(new Error("Loop was stopped"));
          return;
        }

        const cli = backendCliLabel(backend);
        let args: string[];
        let writeStdin: string | null;

        switch (backend) {
          case "copilot": {
            args = ["--model", model, "--autopilot", "-s", "--yolo", "--no-color"];
            if (opts.reasoningEffort) {
              args.push("--reasoning-effort", opts.reasoningEffort);
            }
            writeStdin = prompt;
            break;
          }
          case "cursor-agent": {
            args = [
              "-p",
              normalizePromptForArgv(prompt),
              "--model",
              model,
              "--output-format",
              "text",
            ];
            writeStdin = null;
            break;
          }
          case "claude": {
            args = [
              "-p",
              normalizePromptForArgv(prompt),
              "--model",
              model,
              "--permission-mode",
              "bypassPermissions",
              "--output-format",
              "text",
            ];
            if (opts.reasoningEffort) {
              args.push("--effort", opts.reasoningEffort);
            }
            writeStdin = null;
            break;
          }
          case "gemini": {
            args = [
              "-p",
              normalizePromptForArgv(prompt),
              "-m",
              model,
              "--yolo",
              "--output-format",
              "text",
            ];
            writeStdin = null;
            break;
          }
        }

        const proc = spawn(command, args, {
          cwd: repoRoot,
          shell: shouldUseShellForCommand(command),
          stdio: ["pipe", "pipe", "pipe"],
        });
        this.currentProcess = proc;

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        if (writeStdin !== null) {
          proc.stdin.write(writeStdin);
        }
        proc.stdin.end();

        proc.on("close", (code) => {
          if (this.currentProcess === proc) {
            this.currentProcess = null;
          }
          this.clearKillTimer();
          if (!this.isRunning()) {
            reject(new Error("Loop was stopped"));
          } else if (code !== 0) {
            reject(
              new Error(
                `${cli} exited with code ${code}${stderr ? ": " + stderr.slice(0, 300) : ""}`
              )
            );
          } else {
            resolve(stdout);
          }
        });

        proc.on("error", (err) => {
          if (this.currentProcess === proc) {
            this.currentProcess = null;
          }
          this.clearKillTimer();
          reject(new Error(`Failed to run ${cli}: ${err.message}`));
        });
      })().catch((err: Error) => {
        const backend = normalizeAgentBackend(opts.agentBackend);
        reject(new Error(`Failed to run ${backendCliLabel(backend)}: ${err.message}`));
      });
    });
  }

  stop(): void {
    if (this.currentProcess) {
      const proc = this.currentProcess;
      this.currentProcess = null;
      proc.kill("SIGTERM");
      this.clearKillTimer();
      this.killTimer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // process may have already exited
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
