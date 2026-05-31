// Git and repository operations
import { spawn } from "child_process";
import { access, realpath } from "fs/promises";
import { constants } from "fs";
import path from "path";

/** Resolve symlinks (e.g. macOS /var → /private/var) so git-reported paths compare reliably. */
async function resolveRealPath(filePath: string): Promise<string> {
  try {
    return await realpath(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

async function pathsEqual(a: string, b: string): Promise<boolean> {
  const [resolvedA, resolvedB] = await Promise.all([resolveRealPath(a), resolveRealPath(b)]);
  return resolvedA === resolvedB;
}

export class GitManager {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const abbrev = (await this.runGit(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
      if (abbrev && abbrev !== "HEAD") {
        return abbrev;
      }
    } catch {
      // Unborn branch or detached HEAD — fall back to symbolic-ref.
    }

    try {
      return (await this.runGit(["symbolic-ref", "--short", "HEAD"])).trim();
    } catch {
      return "";
    }
  }

  /** False when the repo has no commits yet (unborn branch). */
  async hasAnyCommits(): Promise<boolean> {
    try {
      await this.runGit(["rev-parse", "--verify", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }

  async createOrCheckoutBranch(branchName: string, fromBranch: string): Promise<void> {
    await this.runGit(["checkout", "-B", branchName, fromBranch]);
  }

  async mergeWorkBranch(
    workBranch: string,
    strategy: "no-ff" | "ff" = "no-ff",
  ): Promise<{ ok: boolean; conflicts?: string[] }> {
    const mergeArgs = strategy === "no-ff"
      ? ["merge", "--no-ff", workBranch]
      : ["merge", workBranch];
    try {
      await this.runGit(mergeArgs);
      return { ok: true };
    } catch {
      // Collect conflict paths
      try {
        const statusOut = await this.runGit(["status", "--porcelain"]);
        const conflicts = statusOut
          .split("\n")
          .filter((line) => line.startsWith("UU") || line.startsWith("AA") || line.startsWith("DD"))
          .map((line) => line.slice(3).trim())
          .filter(Boolean);
        return { ok: false, conflicts };
      } catch {
        return { ok: false, conflicts: [] };
      }
    }
  }

  async getBranchAheadBehind(
    base: string,
    work: string,
  ): Promise<{ ahead: number; behind: number }> {
    try {
      const aheadOut = await this.runGit(["rev-list", "--count", `${base}..${work}`]);
      const behindOut = await this.runGit(["rev-list", "--count", `${work}..${base}`]);
      return {
        ahead: parseInt(aheadOut.trim(), 10) || 0,
        behind: parseInt(behindOut.trim(), 10) || 0,
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  async deleteLocalBranch(branch: string): Promise<void> {
    await this.runGit(["branch", "-d", branch]);
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

  /**
   * Create a git worktree for the given slot at `.ralph/worktrees/slot-<n>`.
   * The worktree branch is named `<baseBranch>-slot-<n>`.
   * Idempotent: if the worktree already exists at the expected path, returns the path without error.
   * @returns Absolute path to the worktree directory.
   */
  async createWorktree(slot: number, baseBranch: string): Promise<string> {
    const relPath = `.ralph/worktrees/slot-${slot}`;
    const worktreePath = path.join(this.repoRoot, relPath);
    const branchName = `${baseBranch}-slot-${slot}`;

    // Check if worktree already exists.
    try {
      const existing = await this.listWorktrees();
      for (const wt of existing) {
        if (await pathsEqual(wt.path, worktreePath)) {
          return worktreePath;
        }
      }
    } catch {
      // proceed to create
    }

    // Create the worktree directory hierarchy if needed.
    await import("fs/promises").then((fsp) =>
      fsp.mkdir(path.dirname(worktreePath), { recursive: true }),
    );

    // Create a new branch from baseBranch and check it out in the worktree.
    try {
      await this.runGit(["worktree", "add", "-b", branchName, worktreePath, baseBranch]);
    } catch (err) {
      // If the branch already exists (e.g. from a previous partial run), use it.
      const msg = String(err);
      if (msg.includes("already exists")) {
        await this.runGit(["worktree", "add", worktreePath, branchName]);
      } else {
        throw err;
      }
    }
    return worktreePath;
  }

  /**
   * Remove the worktree for the given slot.
   * No-op if the worktree directory does not exist.
   */
  async removeWorktree(slot: number): Promise<void> {
    const relPath = `.ralph/worktrees/slot-${slot}`;
    const worktreePath = path.join(this.repoRoot, relPath);
    try {
      await this.runGit(["worktree", "remove", "--force", worktreePath]);
    } catch {
      // Ignore errors — worktree may already be absent.
    }
  }

  /** List all worktrees (main + any added), parsed from `git worktree list --porcelain`. */
  async listWorktrees(): Promise<Array<{ path: string; branch: string; head: string }>> {
    const raw = await this.runGit(["worktree", "list", "--porcelain"]);
    const entries: Array<{ path: string; branch: string; head: string }> = [];
    let current: Partial<{ path: string; branch: string; head: string }> = {};
    const pushCurrent = async () => {
      if (!current.path) return;
      entries.push({
        path: await resolveRealPath(current.path),
        branch: current.branch ?? "(detached)",
        head: current.head ?? "",
      });
      current = {};
    };
    for (const line of raw.split("\n")) {
      if (line.startsWith("worktree ")) {
        if (current.path) {
          await pushCurrent();
        }
        current = { path: line.slice("worktree ".length).trim() };
      } else if (line.startsWith("HEAD ")) {
        current.head = line.slice("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice("branch ".length).trim();
      } else if (line.trim() === "" && current.path) {
        await pushCurrent();
      }
    }
    if (current.path) {
      await pushCurrent();
    }
    return entries;
  }

  /**
   * Merge the slot's branch into `targetBranch` (from the main repo root).
   * Uses --no-ff to preserve history.
   */
  async mergeWorktreeBranch(
    slot: number,
    baseBranch: string,
    _targetBranch: string,
  ): Promise<{ ok: boolean; conflicts?: string[] }> {
    const slotBranch = `${baseBranch}-slot-${slot}`;
    return this.mergeWorkBranch(slotBranch, "no-ff");
  }

  /**
   * Return the container-side working directory path for a given slot.
   * The host bind-mount root is `/workspace`; worktrees live under `.ralph/worktrees/`.
   */
  static worktreeContainerCwd(slot: number): string {
    return `/workspace/.ralph/worktrees/slot-${slot}`;
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
