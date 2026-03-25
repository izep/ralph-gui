// Git and repository operations
import { spawn } from "child_process";
import { access } from "fs/promises";
import { constants } from "fs";
import path from "path";

export class GitManager {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  async getCurrentBranch(): Promise<string> {
    try {
      return (await this.runGit(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    } catch {
      return "";
    }
  }

  async autoCommit(taskNum: number, title: string): Promise<void> {
    try {
      await this.runGit(["add", "-A"]);
      const msg = `ralph: Task #${taskNum} - ${title}`;
      await this.runGit(["commit", "-m", msg, "--allow-empty"]);
    } catch (err) {
      // Commit failed — log separately if needed
      throw err;
    }
  }

  async checkRequirements(): Promise<string | null> {
    const candidates = [
      "requirements.md",
      "REQUIREMENTS.md",
      "Requirements.md",
      "docs/requirements.md",
      "docs/REQUIREMENTS.md",
    ];
    for (const f of candidates) {
      try {
        await access(path.join(this.repoRoot, f), constants.R_OK);
        return f;
      } catch {
        // next
      }
    }
    return null;
  }

  private runGit(gitArgs: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("git", gitArgs, {
        cwd: this.repoRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on("close", (code) => {
        if (code !== 0) reject(new Error(`git ${gitArgs[0]} failed: ${stderr.trim()}`));
        else resolve(stdout);
      });
      proc.on("error", (err) => reject(err));
    });
  }
}
