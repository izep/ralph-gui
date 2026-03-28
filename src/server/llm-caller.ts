// Copilot CLI invocation with model and reasoning parameters
import { spawn, type ChildProcess } from "child_process";
import { constants } from "fs";
import { access } from "fs/promises";
import path from "path";

export interface CopilotOpts {
  reasoningEffort?: string;
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

  for (const candidate of candidates) {
    const resolved = await resolveCommandPath(candidate, env, platform);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error(
    "Copilot CLI not found in PATH. Install GitHub Copilot CLI so `copilot` is available, or set COPILOT_BIN to the executable path.",
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

export class LLMCaller {
  private isRunning: () => boolean;
  private currentProcess: ChildProcess | null = null;
  private killTimer: NodeJS.Timeout | null = null;

  constructor(isRunning: () => boolean) {
    this.isRunning = isRunning;
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

        const command = await resolveCopilotCommand();
        if (!this.isRunning()) {
          reject(new Error("Loop was stopped"));
          return;
        }

        const args = [
          "--model",
          model,
          "--autopilot",
          "-s",
          "--yolo",
          "--no-color",
        ];
        if (opts.reasoningEffort) {
          args.push("--reasoning-effort", opts.reasoningEffort);
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

        proc.stdin.write(prompt);
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
                `copilot exited with code ${code}${stderr ? ": " + stderr.slice(0, 300) : ""}`
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
          reject(new Error(`Failed to run copilot: ${err.message}`));
        });
      })().catch((err: Error) => {
        reject(new Error(`Failed to run copilot: ${err.message}`));
      });
    });
  }

  stop(): void {
    if (this.currentProcess) {
      const proc = this.currentProcess;
      proc.kill("SIGTERM");
      this.clearKillTimer();
      this.killTimer = setTimeout(() => {
        if (this.currentProcess === proc) {
          proc.kill("SIGKILL");
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
