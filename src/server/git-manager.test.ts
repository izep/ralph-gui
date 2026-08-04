import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdtemp, rm, writeFile, realpath } from "fs/promises";
import { execSync } from "child_process";
import { GitManager } from "./git-manager.js";

let tmpDir: string;
let gitManager: GitManager;

function git(args: string, cwd: string = tmpDir): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ralph-git-test-"));
  git("init");
  git(`config user.email "test@test.com"`);
  git(`config user.name "Test"`);
  // Initial commit on main
  await writeFile(path.join(tmpDir, "README.md"), "# test");
  git("add .");
  git(`commit -m "initial"`);
  gitManager = new GitManager(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("GitManager.getCurrentBranch", () => {
  it("returns the current branch name", async () => {
    const branch = await gitManager.getCurrentBranch();
    // git init uses 'main' or 'master' depending on config
    expect(branch).toMatch(/^(main|master)$/);
  });

  it("returns symbolic branch name before the first commit", async () => {
    const unbornDir = await mkdtemp(path.join(os.tmpdir(), "ralph-git-unborn-"));
    try {
      git("init -b bootstrap", unbornDir);
      const unbornGit = new GitManager(unbornDir);
      expect(await unbornGit.getCurrentBranch()).toBe("bootstrap");
      expect(await unbornGit.hasAnyCommits()).toBe(false);
    } finally {
      await rm(unbornDir, { recursive: true, force: true });
    }
  });
});

describe("GitManager.createOrCheckoutBranch", () => {
  it("creates a new branch from base", async () => {
    await gitManager.createOrCheckoutBranch("feature/test", "HEAD");
    const branch = await gitManager.getCurrentBranch();
    expect(branch).toBe("feature/test");
  });

  it("checkouts existing branch with -B flag", async () => {
    git("branch work-branch");
    await gitManager.createOrCheckoutBranch("work-branch", "HEAD");
    const branch = await gitManager.getCurrentBranch();
    expect(branch).toBe("work-branch");
  });
});

describe("GitManager.mergeWorkBranch", () => {
  it("merges work branch commits onto base branch", async () => {
    const baseBranch = await gitManager.getCurrentBranch();

    // Create work branch with a commit
    await gitManager.createOrCheckoutBranch("work-branch", "HEAD");
    await writeFile(path.join(tmpDir, "feature.txt"), "new feature");
    git("add .");
    git(`commit -m "add feature"`);

    // Switch back to base and merge
    git(`checkout ${baseBranch}`);
    const result = await gitManager.mergeWorkBranch("work-branch");
    expect(result.ok).toBe(true);

    // Verify file is now on base
    const log = git("log --oneline");
    expect(log).toContain("add feature");
  });

  it("returns conflict paths when merge conflicts occur", async () => {
    const baseBranch = await gitManager.getCurrentBranch();

    // Create conflicting commits on both branches
    await writeFile(path.join(tmpDir, "conflict.txt"), "base content");
    git("add .");
    git(`commit -m "base conflict file"`);

    await gitManager.createOrCheckoutBranch("work-branch", baseBranch);
    await writeFile(path.join(tmpDir, "conflict.txt"), "work branch content");
    git("add .");
    git(`commit -m "work branch change"`);

    git(`checkout ${baseBranch}`);
    await writeFile(path.join(tmpDir, "conflict.txt"), "base branch change");
    git("add .");
    git(`commit -m "base branch change"`);

    const result = await gitManager.mergeWorkBranch("work-branch");
    expect(result.ok).toBe(false);
    // Abort the merge to clean up
    try { git("merge --abort"); } catch { /* */ }
  });
});

describe("GitManager.getBranchAheadBehind", () => {
  it("returns correct ahead/behind counts", async () => {
    const baseBranch = await gitManager.getCurrentBranch();

    // Create work branch with 2 commits
    await gitManager.createOrCheckoutBranch("work-branch", baseBranch);
    await writeFile(path.join(tmpDir, "file1.txt"), "1");
    git("add .");
    git(`commit -m "commit 1"`);
    await writeFile(path.join(tmpDir, "file2.txt"), "2");
    git("add .");
    git(`commit -m "commit 2"`);

    git(`checkout ${baseBranch}`);
    const counts = await gitManager.getBranchAheadBehind(baseBranch, "work-branch");
    expect(counts.ahead).toBe(2);
    expect(counts.behind).toBe(0);
  });

  it("returns 0/0 for branches at same commit", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    git("branch same-as-base");
    const counts = await gitManager.getBranchAheadBehind(baseBranch, "same-as-base");
    expect(counts.ahead).toBe(0);
    expect(counts.behind).toBe(0);
  });
});

describe("GitManager.deleteLocalBranch", () => {
  it("deletes a merged branch", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    await gitManager.createOrCheckoutBranch("to-delete", baseBranch);
    git(`checkout ${baseBranch}`);
    await gitManager.deleteLocalBranch("to-delete");
    const branches = git("branch");
    expect(branches).not.toContain("to-delete");
  });
});

// ---------------------------------------------------------------------------
// GitManager worktree helpers (Epic 004)
// ---------------------------------------------------------------------------

describe("GitManager worktree helpers", () => {
  it("createWorktree creates directory and branch", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    const wtPath = await gitManager.createWorktree(0, baseBranch);

    // Directory should exist
    const { stat } = await import("fs/promises");
    const stats = await stat(wtPath);
    expect(stats.isDirectory()).toBe(true);
    expect(wtPath).toContain("slot-0");
  });

  it("createWorktree is idempotent — calling twice does not throw", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    const p1 = await gitManager.createWorktree(1, baseBranch);
    const p2 = await gitManager.createWorktree(1, baseBranch);
    expect(p1).toBe(p2);
  });

  it("listWorktrees returns at least the main worktree", async () => {
    const wts = await gitManager.listWorktrees();
    expect(wts.length).toBeGreaterThanOrEqual(1);
    expect(wts[0].path).toBe(await realpath(tmpDir));
  });

  it("listWorktrees returns created worktree", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    await gitManager.createWorktree(3, baseBranch);
    const wts = await gitManager.listWorktrees();
    const found = wts.find((w) => w.path.includes("slot-3"));
    expect(found).toBeTruthy();
  });

  it("removeWorktree removes the directory", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    const wtPath = await gitManager.createWorktree(4, baseBranch);

    const { stat } = await import("fs/promises");
    await stat(wtPath); // should not throw (exists)

    await gitManager.removeWorktree(4);

    await expect(stat(wtPath)).rejects.toThrow();
  });

  it("removeWorktree is a no-op when worktree does not exist", async () => {
    await expect(gitManager.removeWorktree(99)).resolves.not.toThrow();
  });

  it("worktreeContainerCwd returns expected path for slot", () => {
    expect(GitManager.worktreeContainerCwd(0)).toBe(
      "/workspace/.ralph/worktrees/slot-0",
    );
    expect(GitManager.worktreeContainerCwd(2)).toBe(
      "/workspace/.ralph/worktrees/slot-2",
    );
  });
});

// ---------------------------------------------------------------------------
// GitManager.autoCommit with cwd (worktree-aware)
// ---------------------------------------------------------------------------

describe("GitManager.autoCommit with cwd", () => {
  it("commits in the worktree directory when cwd is provided", async () => {
    const baseBranch = await gitManager.getCurrentBranch();
    const worktreePath = await gitManager.createWorktree(0, baseBranch);

    // Write a file inside the worktree
    await writeFile(path.join(worktreePath, "wt-file.txt"), "hello", "utf-8");

    // autoCommit with worktree cwd
    await gitManager.autoCommit(1, "worktree task", worktreePath);

    // Verify commit appears on the slot branch
    const log = git(`log --oneline`, worktreePath);
    expect(log).toContain("ralph: Task #1 - worktree task");
  });

  it("commits on main repo when no cwd is provided", async () => {
    await writeFile(path.join(tmpDir, "main-file.txt"), "world", "utf-8");
    await gitManager.autoCommit(2, "main task");
    const log = git("log --oneline");
    expect(log).toContain("ralph: Task #2 - main task");
  });
});

// ---------------------------------------------------------------------------
// GitManager.mergeWorktreeBranch checks out targetBranch before merging
// ---------------------------------------------------------------------------

describe("GitManager.hasMergeInProgress", () => {
  it("returns false when no merge is in progress", async () => {
    expect(await gitManager.hasMergeInProgress()).toBe(false);
  });

  it("returns true while a merge has conflicts left unresolved", async () => {
    const root = (await gitManager.getCurrentBranch()) || "main";
    git(`branch merge-a ${root}`);
    git(`branch merge-b ${root}`);
    git("checkout merge-a");
    await writeFile(path.join(tmpDir, "both.txt"), "a", "utf-8");
    git("add both.txt");
    git('commit -m "a"');
    git("checkout merge-b");
    await writeFile(path.join(tmpDir, "both.txt"), "b", "utf-8");
    git("add both.txt");
    git('commit -m "b"');
    git("checkout merge-a");
    try {
      execSync("git merge merge-b", { cwd: tmpDir, encoding: "utf-8", stdio: "pipe" });
    } catch {
      // expected conflict
    }
    expect(await gitManager.hasMergeInProgress()).toBe(true);
    git("merge --abort");
  });
});

describe("GitManager.mergeWorktreeBranch checkout behavior", () => {
  it("checks out targetBranch before merging slot branch", async () => {
    const baseBranch = await gitManager.getCurrentBranch();

    // Create a target branch from base
    git(`checkout -b target-branch`);
    git(`checkout ${baseBranch}`);

    // Create a worktree slot from baseBranch
    const worktreePath = await gitManager.createWorktree(0, baseBranch);

    // Commit something in the worktree
    await writeFile(path.join(worktreePath, "slot-file.txt"), "slot change", "utf-8");
    git("add .", worktreePath);
    git(`commit -m "slot commit"`, worktreePath);

    // Start on baseBranch (not target-branch)
    expect(git("rev-parse --abbrev-ref HEAD")).toBe(baseBranch);

    // mergeWorktreeBranch should checkout target-branch then merge
    const result = await gitManager.mergeWorktreeBranch(0, baseBranch, "target-branch");
    expect(result.ok).toBe(true);

    // Main worktree HEAD should now be on target-branch
    expect(git("rev-parse --abbrev-ref HEAD")).toBe("target-branch");

    // The slot commit should be present on target-branch
    const log = git("log --oneline");
    expect(log).toContain("slot commit");
  });
});
