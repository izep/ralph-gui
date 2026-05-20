import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";
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
