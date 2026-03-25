// Copilot CLI invocation with model and reasoning parameters
import { spawn, type ChildProcess } from "child_process";

export interface CopilotOpts {
  reasoningEffort?: string;
}

export class LLMCaller {
  private isRunning: () => boolean;
  private currentProcess: ChildProcess | null = null;

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

      const proc = spawn("copilot", args, {
        cwd: repoRoot,
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
        this.currentProcess = null;
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
        this.currentProcess = null;
        reject(new Error(`Failed to run copilot: ${err.message}`));
      });
    });
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
    }
  }
}
