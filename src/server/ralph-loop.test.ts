import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { constants } from "fs";
import { RalphLoop } from "./ralph-loop.js";
import type { LoopCallbacks } from "./ralph-loop.js";
import { DEFAULT_SETTINGS } from "./templates.js";

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
