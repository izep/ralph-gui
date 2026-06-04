import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock docker-pool and docker-runner early so RalphLoop imports use the mocks.
vi.mock("./docker-pool.js", () => {
  class MockDockerPool {
    size: number;
    counter: number;
    released: number[];
    constructor(size: number) { this.size = size; this.counter = 0; this.released = []; }
    init(): void {}
    acquire(): Promise<number> { return Promise.resolve(this.counter++); }
    release(slot: number): void { this.released.push(slot); }
    stopAll(): void {}
  }
  return { ensureDockerPool: vi.fn(() => Promise.resolve()), DockerPool: MockDockerPool };
});

vi.mock("./docker-runner.js", () => ({
  checkDockerHost: vi.fn(() => Promise.resolve({ ok: true })),
  ensureDockerAgentRunning: vi.fn(() => Promise.resolve({ ok: true })),
  resolveComposeFile: vi.fn(() => "/compose.yml"),
  resolveAgentCliInDockerContainer: vi.fn(() => Promise.resolve('/usr/local/bin/copilot')),
  resolveDockerSocketPath: vi.fn(() => "/var/run/docker.sock"),
}));

import { mkdtemp, rm, readFile, writeFile, mkdir, access } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { constants } from "fs";
import { RalphLoop } from "./ralph-loop.js";
import type { LoopCallbacks } from "./ralph-loop.js";
import { DEFAULT_SETTINGS } from "./templates.js";
import type { LLMCallOpts } from "./llm-caller.js";

function makeCallbacks(): LoopCallbacks & {
  logs: string[];
  statuses: { status: string; error: string | null }[];
  taskUpdates: object[];
} {
  const logs: string[] = [];
  const statuses: { status: string; error: string | null }[] = [];
  const taskUpdates: object[] = [];
  return {
    logs,
    statuses,
    taskUpdates,
    onLog: (line: string) => logs.push(line),
    onLoopStatus: (status: string, error: string | null) =>
      statuses.push({ status, error }),
    onTasksUpdated: (data: object) => taskUpdates.push(data),
  };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "ralph-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// bootstrap
// ---------------------------------------------------------------------------

describe("RalphLoop.bootstrap", () => {
  it("creates ralph/ directory and default files", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    const ralphDir = path.join(tmpDir, "ralph");
    await access(ralphDir, constants.R_OK); // should not throw

    const expectedFiles = [
      "plan-prompt.md",
      "dev-prompt.md",
      "qa-prompt.md",
      "memory.md",
      "epic.md",
      "settings.json",
    ];
    for (const f of expectedFiles) {
      await access(path.join(ralphDir, f), constants.R_OK);
    }
  });

  it("does not overwrite existing files", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);

    // Create ralph dir with a custom epic file
    const ralphDir = path.join(tmpDir, "ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeFile(path.join(ralphDir, "epic.md"), "Custom epic", "utf-8");

    await loop.bootstrap();

    const content = await readFile(path.join(ralphDir, "epic.md"), "utf-8");
    expect(content).toBe("Custom epic");
  });
});

// ---------------------------------------------------------------------------
// readSettings
// ---------------------------------------------------------------------------

describe("RalphLoop.readSettings", () => {
  it("returns defaults when settings.json does not exist", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const settings = await loop.readSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("merges saved settings with defaults", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    // Write partial settings
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify({ maxLLMCalls: 50 }),
      "utf-8"
    );

    const settings = await loop.readSettings();
    expect(settings.maxLLMCalls).toBe(50);
    expect(settings.planModel).toBe(DEFAULT_SETTINGS.planModel);
    expect(settings.autoCommit).toBe(DEFAULT_SETTINGS.autoCommit);
  });

  it("handles corrupted JSON gracefully", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      "not valid json{{{",
      "utf-8"
    );

    const settings = await loop.readSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------
// readStatusFile
// ---------------------------------------------------------------------------

describe("RalphLoop.readStatusFile", () => {
  it("returns default status when file does not exist", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const status = await loop.readStatusFile();
    expect(status.tasks).toEqual([]);
    expect(status.currentTaskNum).toBe(0);
    expect(status.totalLLMCalls).toBe(0);
  });

  it("reads existing status file", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    const statusData = {
      tasks: [
        {
          id: 1,
          title: "Test task",
          description: "",
          status: "done",
          devIterations: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      currentTaskNum: 1,
      totalLLMCalls: 5,
      maxLLMCalls: 100,
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };

    await writeFile(
      path.join(tmpDir, "ralph", "task-status.json"),
      JSON.stringify(statusData),
      "utf-8"
    );

    const result = await loop.readStatusFile();
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Test task");
    expect(result.totalLLMCalls).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// checkRequirements
// ---------------------------------------------------------------------------

describe("RalphLoop.checkRequirements", () => {
  it("returns null when no requirements file exists", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const result = await loop.checkRequirements();
    expect(result).toBeNull();
  });

  it("finds requirements.md in repo root", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");
    const result = await loop.checkRequirements();
    expect(result).toBe("requirements.md");
  });

  it("finds REQUIREMENTS.md (case variant)", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await writeFile(path.join(tmpDir, "REQUIREMENTS.md"), "# Reqs", "utf-8");
    const result = await loop.checkRequirements();
    // On case-insensitive filesystems (macOS), the first candidate
    // "requirements.md" matches so the returned name is lowercase.
    expect(result).toMatch(/^(requirements\.md|REQUIREMENTS\.md)$/);  
  });

  it("finds requirements in docs/ subdirectory", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await mkdir(path.join(tmpDir, "docs"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "docs", "requirements.md"),
      "# Reqs",
      "utf-8"
    );
    const result = await loop.checkRequirements();
    expect(result).toBe("docs/requirements.md");
  });
});

// ---------------------------------------------------------------------------
// start / stop
// ---------------------------------------------------------------------------

describe("RalphLoop.start", () => {
  it("returns error when no requirements file exists", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nShip the next milestone.");
    const result = await loop.start();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No requirements document found");
  });

  it("returns error when epic is not configured", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    const result = await loop.start();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Epic is not configured");
  });

  it("returns error when loop is already running", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nDeliver the sprint goals.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    // Start first
    const first = await loop.start();
    expect(first.ok).toBe(true);

    // Try to start again
    const second = await loop.start();
    expect(second.ok).toBe(false);
    expect(second.error).toContain("already running");

    // Clean up — stop and let async loop settle
    loop.stop();
    await new Promise((r) => setTimeout(r, 100));
  });
});

describe("RalphLoop.stop", () => {
  it("returns error when loop is not running", () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const result = loop.stop();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not running");
  });

  it("stops a running loop and fires callback", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nValidate loop stop behavior.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    await loop.start();
    expect(loop.isRunning).toBe(true);

    const result = loop.stop();
    expect(result.ok).toBe(true);
    expect(loop.isRunning).toBe(false);
    expect(cb.statuses).toContainEqual({ status: "stopped", error: null });

    // Let async loop settle before temp dir cleanup
    await new Promise((r) => setTimeout(r, 100));
  });
});

describe("RalphLoop.restart", () => {
  it("returns start error when requirements are missing", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nTest restart preconditions.");
    const result = await loop.restart();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No requirements document found");
  });

  it("restarts successfully when requirements are present", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nRestart should succeed with requirements.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");
    const result = await loop.restart();
    expect(result.ok).toBe(true);

    // Let async operations settle before temp dir cleanup
    loop.stop();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("waits for the previous run to settle before starting again", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nRestart should wait for cleanup.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    let runCount = 0;
    let releaseFirstRun!: () => void;
    const firstRunSettled = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });

    (loop as any).runLoop = () => {
      runCount += 1;
      if (runCount === 1) {
        return firstRunSettled;
      }

      return Promise.resolve();
    };

    expect((await loop.start()).ok).toBe(true);

    const restartPromise = loop.restart();
    await new Promise((r) => setTimeout(r, 25));
    expect(runCount).toBe(1);

    releaseFirstRun();
    const result = await restartPromise;

    expect(result.ok).toBe(true);
    expect(runCount).toBe(2);
  });
});

describe("RalphLoop stop lifecycle", () => {
  it("does not report a stopped run as an error when cleanup rejects", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeRalphFile("epic.md", "# Epic\n\nStop should not surface cleanup errors.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    let rejectRun!: (err: Error) => void;
    const runPromise = new Promise<void>((_resolve, reject) => {
      rejectRun = reject;
    });

    (loop as any).runLoop = () => runPromise;

    expect((await loop.start()).ok).toBe(true);
    expect(loop.stop().ok).toBe(true);

    rejectRun(new Error("forced stop failure"));
    await new Promise((r) => setTimeout(r, 25));

    expect(cb.statuses).toContainEqual({ status: "stopped", error: null });
    expect(cb.statuses).not.toContainEqual({ status: "error", error: "forced stop failure" });
  });
});

// ---------------------------------------------------------------------------
// refreshBacklog
// ---------------------------------------------------------------------------

describe("RalphLoop.refreshBacklog", () => {
  it("returns error when no requirements file exists", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const result = await loop.refreshBacklog();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No requirements document found");
  });

  it("reports not refreshing after completion", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.refreshBacklog();
    expect(loop.isRefreshing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readRalphFile / writeRalphFile
// ---------------------------------------------------------------------------

describe("RalphLoop file helpers", () => {
  it("writes and reads ralph files", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    await loop.writeRalphFile("test.md", "Hello world");
    const content = await loop.readRalphFile("test.md");
    expect(content).toBe("Hello world");
  });

  it("rejects path traversal attempts", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();

    await expect(loop.readRalphFile("../../etc/passwd")).rejects.toThrow("Invalid file name");
    await expect(loop.writeRalphFile("../escape.txt", "bad")).rejects.toThrow("Invalid file name");
  });
});

// ---------------------------------------------------------------------------
// readEpic
// ---------------------------------------------------------------------------

describe("RalphLoop.readEpic", () => {
  it("returns empty string when epic file does not exist", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const content = await loop.readEpic();
    expect(content).toBe("");
  });

  it("reads from default path ralph/epic.md after bootstrap", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(path.join(tmpDir, "ralph", "epic.md"), "# My Epic", "utf-8");
    const content = await loop.readEpic();
    expect(content).toBe("# My Epic");
  });

  it("reads from custom epicFile path configured in settings", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify({ epicFile: "docs/epic.md" }),
      "utf-8"
    );
    await mkdir(path.join(tmpDir, "docs"), { recursive: true });
    await writeFile(path.join(tmpDir, "docs", "epic.md"), "# Custom Epic", "utf-8");
    const content = await loop.readEpic();
    expect(content).toBe("# Custom Epic");
  });
});

// ---------------------------------------------------------------------------
// writeEpic
// ---------------------------------------------------------------------------

describe("RalphLoop.writeEpic", () => {
  it("writes content to the default epic path", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Hello");
    const content = await readFile(path.join(tmpDir, "ralph", "epic.md"), "utf-8");
    expect(content).toBe("# Hello");
  });

  it("creates parent directories and writes to a custom path", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify({ epicFile: "nested/dir/epic.md" }),
      "utf-8"
    );
    await loop.writeEpic("# Nested");
    const content = await readFile(path.join(tmpDir, "nested", "dir", "epic.md"), "utf-8");
    expect(content).toBe("# Nested");
  });
});

// ---------------------------------------------------------------------------
// isEpicConfigured
// ---------------------------------------------------------------------------

describe("RalphLoop.isEpicConfigured", () => {
  it("returns false when epic has default placeholder content", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    const result = await loop.isEpicConfigured();
    expect(result).toBe(false);
  });

  it("returns false when epic file does not exist", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    const result = await loop.isEpicConfigured();
    expect(result).toBe(false);
  });

  it("returns true when epic has real content", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Real Epic\n\nBuild something great.");
    const result = await loop.isEpicConfigured();
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkRequirements (configured path)
// ---------------------------------------------------------------------------

describe("RalphLoop.checkRequirements (configured path)", () => {
  it("uses requirementsFile from settings when set", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify({ requirementsFile: "docs/reqs.md" }),
      "utf-8"
    );
    await mkdir(path.join(tmpDir, "docs"), { recursive: true });
    await writeFile(path.join(tmpDir, "docs", "reqs.md"), "# Reqs", "utf-8");
    const result = await loop.checkRequirements();
    expect(result).toBe("docs/reqs.md");
  });

  it("returns null when configured requirementsFile does not exist", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify({ requirementsFile: "nonexistent.md" }),
      "utf-8"
    );
    const result = await loop.checkRequirements();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Smart resume
// ---------------------------------------------------------------------------

describe("RalphLoop smart resume", () => {
  async function writeTaskStatus(dir: string, tasks: object[]) {
    const statusData = {
      tasks,
      currentTaskNum: 1,
      totalLLMCalls: 5,
      maxLLMCalls: 100,
      nextTask: { taskId: 1, content: "prior content", updatedAt: new Date().toISOString() },
      feedback: { taskId: null, content: "", updatedAt: new Date().toISOString() },
      lastUpdated: new Date().toISOString(),
    };
    await writeFile(
      path.join(dir, "ralph", "task-status.json"),
      JSON.stringify(statusData),
      "utf-8"
    );
  }

  it("logs resume-dev message when an inProgress task exists", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Epic\n\nTest smart resume.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");
    await writeTaskStatus(tmpDir, [
      {
        id: 1,
        title: "Implement feature",
        description: "Do the thing",
        status: "inProgress",
        devIterations: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    await loop.start();
    await new Promise((r) => setTimeout(r, 80));

    expect(cb.logs.some((l) => l.includes("Resuming dev for task #1"))).toBe(true);

    loop.stop();
    await new Promise((r) => setTimeout(r, 100));
  });

  it("logs resume-QA message when an inQa task exists", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Epic\n\nTest QA resume.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");
    await writeTaskStatus(tmpDir, [
      {
        id: 2,
        title: "Review auth flow",
        description: "Check the auth",
        status: "inQa",
        devIterations: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    await loop.start();
    await new Promise((r) => setTimeout(r, 80));

    expect(cb.logs.some((l) => l.includes("Resuming QA for task #2"))).toBe(true);

    loop.stop();
    await new Promise((r) => setTimeout(r, 100));
  });
});

// ---------------------------------------------------------------------------
// Parallel dispatch test (Epic 004)
// ---------------------------------------------------------------------------

describe("RalphLoop parallel dispatch", () => {
  it("dispatches backlog tasks in parallel using docker pool", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Epic\n\nParallel dispatch test.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    // Write settings enabling docker parallel pool
    const settings = { ...DEFAULT_SETTINGS, useDocker: true, dockerPoolSize: 2, dockerParallelTasks: true };
    await writeFile(path.join(tmpDir, "ralph", "settings.json"), JSON.stringify(settings), "utf-8");

    // Write task-status.json with 2 backlog tasks
    const status = {
      tasks: [
        { id: 1, title: "Task One", description: "Do one", status: "backlog", devIterations: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 2, title: "Task Two", description: "Do two", status: "backlog", devIterations: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      nextTask: { taskId: null, content: "", updatedAt: new Date().toISOString() },
      feedback: { taskId: null, content: "", updatedAt: new Date().toISOString() },
      lastUpdated: new Date().toISOString(),
    };
    await writeFile(path.join(tmpDir, "ralph", "task-status.json"), JSON.stringify(status), "utf-8");

    // Mock GitManager branch/worktree operations so start() succeeds
    const gitMod = await import("./git-manager.js");
    vi.spyOn(gitMod.GitManager.prototype, "getCurrentBranch").mockResolvedValue("main");
    vi.spyOn(gitMod.GitManager.prototype, "hasAnyCommits").mockResolvedValue(true);
    vi.spyOn(gitMod.GitManager.prototype, "createOrCheckoutBranch").mockResolvedValue(undefined);
    vi.spyOn(gitMod.GitManager.prototype, "createWorktree").mockResolvedValue("/workspace/.ralph/worktrees/slot-0");
    vi.spyOn(gitMod.GitManager.prototype, "mergeWorktreeBranch").mockResolvedValue({ ok: true });

    // Replace runDevQALoop with a stub that records concurrent executions
    const dp = await import("./docker-pool.js");
    vi.spyOn(dp.DockerPool.prototype, "release");
    vi.spyOn(dp.DockerPool.prototype, "acquire");

    // Ensure SettingsManager.read returns the docker-parallel settings
    const sm = await import("./settings-manager.js");
    vi.spyOn(sm.SettingsManager.prototype, "read").mockResolvedValue({ ...DEFAULT_SETTINGS, useDocker: true, dockerPoolSize: 2, dockerParallelTasks: true, minBacklogSize: 3 });

    const concurrency = { inFlight: 0, max: 0 };
    (loop as any).runDevQALoop = async function (
      _taskId: number,
      _title: string,
      _content: string,
      _totalLLMCalls: number,
      _startAtQa = false,
      _slotOpts?: { containerIndex?: number; worktreeCwd?: string },
    ) {
      concurrency.inFlight += 1;
      concurrency.max = Math.max(concurrency.max, concurrency.inFlight);
      // simulate work (longer to ensure overlap)
      await new Promise((r) => setTimeout(r, 200));
      concurrency.inFlight -= 1;
      return { totalLLMCalls: _totalLLMCalls + 1 };
    };

    // Stub LLMCaller.call to avoid invoking docker-runner during plan phase
    const llmMod = await import("./llm-caller.js");
    vi.spyOn(llmMod.LLMCaller.prototype, "call").mockImplementation(async () => "OK");

    // Start the loop
    const startRes = await loop.start();
    if (!startRes.ok) {
      throw new Error(`start failed: ${startRes.error} -- logs: ${JSON.stringify(cb.logs)}`);
    }
    expect(startRes.ok).toBe(true);

    // Wait for parallel work to start
    await new Promise((r) => setTimeout(r, 300));
    // Debug logs for diagnosing concurrency
    // eslint-disable-next-line no-console
    console.log('CB LOGS:', cb.logs);
    // Ensure the loop reached the parallel dispatch path and used the Docker pool
    expect(cb.logs.some((l) => l.includes("Parallel dispatch"))).toBe(true);
    expect(dp.DockerPool.prototype.acquire).toHaveBeenCalled();
    // Ensure LLMCaller was invoked for tasks and that at least two tasks ran concurrently
    expect(llmMod.LLMCaller.prototype.call).toHaveBeenCalled();
    expect((llmMod.LLMCaller.prototype.call as any).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(concurrency.max).toBeGreaterThanOrEqual(2);

    // Wait for loop to settle
    await new Promise((r) => setTimeout(r, 200));

    // Ensure pool initialization log present and pool releases called
    expect(cb.logs.some((l) => l.includes("Docker pool ready"))).toBe(true);
    expect((dp.DockerPool.prototype.release as any).mock.calls.length).toBeGreaterThan(0);

    // Stop loop
    loop.stop();
    await new Promise((r) => setTimeout(r, 50));
  });
});

// ---------------------------------------------------------------------------
// Plan-phase parallel research dispatch (dockerPlanParallel)
// ---------------------------------------------------------------------------

describe("RalphLoop plan-phase parallel dispatch", () => {
  it("dispatches research sub-prompts concurrently when dockerPlanParallel is true", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Epic\n\nPlan parallel test.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    const settings = {
      ...DEFAULT_SETTINGS,
      useDocker: true,
      dockerPoolSize: 2,
      dockerParallelTasks: false,
      dockerPlanParallel: true,
    };
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify(settings),
      "utf-8",
    );

    // Mock GitManager operations
    const gitMod = await import("./git-manager.js");
    vi.spyOn(gitMod.GitManager.prototype, "getCurrentBranch").mockResolvedValue("main");
    vi.spyOn(gitMod.GitManager.prototype, "hasAnyCommits").mockResolvedValue(true);
    vi.spyOn(gitMod.GitManager.prototype, "createOrCheckoutBranch").mockResolvedValue(undefined);
    vi.spyOn(gitMod.GitManager.prototype, "createWorktree").mockResolvedValue("/workspace/.ralph/worktrees/slot-0");
    vi.spyOn(gitMod.GitManager.prototype, "mergeWorktreeBranch").mockResolvedValue({ ok: true });

    const dp = await import("./docker-pool.js");
    vi.spyOn(dp.DockerPool.prototype, "acquire");
    vi.spyOn(dp.DockerPool.prototype, "release");

    const sm = await import("./settings-manager.js");
    vi.spyOn(sm.SettingsManager.prototype, "read").mockResolvedValue({
      ...DEFAULT_SETTINGS,
      useDocker: true,
      dockerPoolSize: 2,
      dockerParallelTasks: false,
      dockerPlanParallel: true,
      minBacklogSize: 3,
    });

    const llmMod = await import("./llm-caller.js");
    const callSpy = vi.spyOn(llmMod.LLMCaller.prototype, "call").mockImplementation(
      async (_prompt: string, _model: string, _cwd: string, opts: LLMCallOpts) => {
        // Sub-jobs from research prompts return a task list
        if (opts?.dockerContainerIndex != null) {
          return `\`\`\`json\n[{"id":10,"title":"Sub task","description":"from sub-job","status":"backlog"}]\n\`\`\``;
        }
        // Plan call returns research prompts + a primary task
        return (
          `<research-prompt>Research sub-prompt A</research-prompt>\n` +
          `<research-prompt>Research sub-prompt B</research-prompt>\n` +
          `\`\`\`json\n[{"id":1,"title":"Primary task","description":"main task","status":"backlog"}]\n\`\`\``
        );
      },
    );

    const startRes = await loop.start();
    if (!startRes.ok) {
      throw new Error(`start failed: ${startRes.error} -- logs: ${JSON.stringify(cb.logs)}`);
    }

    // Allow plan phase + sub-jobs to run
    await new Promise((r) => setTimeout(r, 400));

    // Plan parallel log should appear
    expect(cb.logs.some((l) => l.includes("Plan parallel: dispatching 2 research sub-job"))).toBe(true);
    // Pool slots must have been acquired for the sub-jobs
    expect(dp.DockerPool.prototype.acquire).toHaveBeenCalled();
    expect(dp.DockerPool.prototype.release).toHaveBeenCalled();
    // LLMCaller called for plan + 2 sub-jobs = at least 3 calls
    expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    // Two of those calls had a distinct dockerContainerIndex
    const subJobCalls = callSpy.mock.calls.filter(
      (c) => (c[3] as Record<string, unknown> | undefined)?.dockerContainerIndex != null,
    );
    expect(subJobCalls.length).toBe(2);
    // The two sub-job calls had different container indices
    const indices = subJobCalls.map(
      (c) => (c[3] as Record<string, unknown>).dockerContainerIndex as number,
    );
    expect(new Set(indices).size).toBe(2);

    loop.stop();
    await new Promise((r) => setTimeout(r, 50));
  });

  it("keeps plan phase sequential when dockerPlanParallel is false", async () => {
    const cb = makeCallbacks();
    const loop = new RalphLoop(tmpDir, cb);
    await loop.bootstrap();
    await loop.writeEpic("# Epic\n\nSequential plan test.");
    await writeFile(path.join(tmpDir, "requirements.md"), "# Reqs", "utf-8");

    const settings = {
      ...DEFAULT_SETTINGS,
      useDocker: true,
      dockerPoolSize: 2,
      dockerParallelTasks: false,
      dockerPlanParallel: false,
    };
    await writeFile(
      path.join(tmpDir, "ralph", "settings.json"),
      JSON.stringify(settings),
      "utf-8",
    );

    const gitMod = await import("./git-manager.js");
    vi.spyOn(gitMod.GitManager.prototype, "getCurrentBranch").mockResolvedValue("main");
    vi.spyOn(gitMod.GitManager.prototype, "createOrCheckoutBranch").mockResolvedValue(undefined);

    const sm = await import("./settings-manager.js");
    vi.spyOn(sm.SettingsManager.prototype, "read").mockResolvedValue({
      ...DEFAULT_SETTINGS,
      useDocker: true,
      dockerPoolSize: 2,
      dockerParallelTasks: false,
      dockerPlanParallel: false,
      minBacklogSize: 3,
    });

    const llmMod = await import("./llm-caller.js");
    const callSpy = vi.spyOn(llmMod.LLMCaller.prototype, "call").mockImplementation(async () => {
      return (
        `<research-prompt>Research that should be ignored</research-prompt>\n` +
        `\`\`\`json\n[{"id":1,"title":"Task","description":"desc","status":"backlog"}]\n\`\`\``
      );
    });
    // Clear accumulated calls from any previous tests
    callSpy.mockClear();

    const dp = await import("./docker-pool.js");
    const acquireSpy = vi.spyOn(dp.DockerPool.prototype, "acquire");
    // Clear any calls accumulated from previous tests in this describe block
    acquireSpy.mockClear();

    await loop.start();
    await new Promise((r) => setTimeout(r, 200));

    // No parallel research log
    expect(cb.logs.some((l) => l.includes("Plan parallel:"))).toBe(false);
    // Pool acquire must NOT have been called (no pool is initialized since both flags are false)
    expect(acquireSpy).not.toHaveBeenCalled();
    // Only the plan LLM call ran (no extra sub-job calls with containerIndex)
    const subJobCalls = callSpy.mock.calls.filter(
      (c) => (c[3] as Record<string, unknown> | undefined)?.dockerContainerIndex != null,
    );
    expect(subJobCalls.length).toBe(0);

    loop.stop();
    await new Promise((r) => setTimeout(r, 50));
  });
});
