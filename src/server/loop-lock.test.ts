import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { acquireRepoLoopLock, releaseRepoLoopLock, loopLockPath } from "./loop-lock.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "ralph-lock-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("acquireRepoLoopLock", () => {
  it("allows the same owner to acquire twice", () => {
    acquireRepoLoopLock(tmpDir, "a");
    acquireRepoLoopLock(tmpDir, "a");
    releaseRepoLoopLock(tmpDir, "a");
  });

  it("refuses a second owner in the same process", () => {
    acquireRepoLoopLock(tmpDir, "a");
    expect(() => acquireRepoLoopLock(tmpDir, "b")).toThrow(/already running for this repo/);
    releaseRepoLoopLock(tmpDir, "a");
  });

  it("refuses a lock held by a living pid", async () => {
    const child = spawn("sleep", ["30"], { stdio: "ignore" });
    try {
      await mkdir(path.join(tmpDir, "ralph"), { recursive: true });
      await writeFile(loopLockPath(tmpDir), `${child.pid} other\n`);
      expect(() => acquireRepoLoopLock(tmpDir, "a")).toThrow(
        new RegExp(`already running for this repo \\(pid ${child.pid}\\)`),
      );
    } finally {
      child.kill("SIGKILL");
    }
  });

  it("steals a stale lock from a dead pid", async () => {
    await mkdir(path.join(tmpDir, "ralph"), { recursive: true });
    await writeFile(loopLockPath(tmpDir), "999999999 stale\n");
    acquireRepoLoopLock(tmpDir, "a");
    releaseRepoLoopLock(tmpDir, "a");
  });

  it("can re-acquire after release", () => {
    acquireRepoLoopLock(tmpDir, "a");
    releaseRepoLoopLock(tmpDir, "a");
    acquireRepoLoopLock(tmpDir, "b");
    releaseRepoLoopLock(tmpDir, "b");
  });
});
