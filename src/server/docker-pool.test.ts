import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.spawn before importing docker-pool
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import { ensureDockerPool, listPoolContainers, DockerPool } from "./docker-pool.js";

class MockProc {
  stdout = { on: vi.fn() };
  stderr = { on: vi.fn() };
  private closeHandlers: Array<(code: number) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];

  on(event: string, handler: (...args: unknown[]) => void): this {
    if (event === "close") this.closeHandlers.push(handler as (code: number) => void);
    if (event === "error") this.errorHandlers.push(handler as (err: Error) => void);
    return this;
  }

  kill() {}

  emitClose(code: number, stdoutData?: string) {
    if (stdoutData) {
      const stdoutCalls = this.stdout.on.mock.calls as any[][];
      stdoutCalls
        .filter((c) => c[0] === "data")
        .forEach((c) => (c[1] as (d: Buffer) => void)(Buffer.from(stdoutData)));
    }
    this.closeHandlers.forEach((h) => h(code));
  }
}

/**
 * Register a proc that emits close AFTER the caller has registered handlers.
 * Using queueMicrotask ensures emission happens after synchronous handler registration.
 */
function makeProcAsync(code: number, stdoutData?: string): MockProc {
  const proc = new MockProc();
  spawnMock.mockImplementationOnce(() => {
    queueMicrotask(() => proc.emitClose(code, stdoutData));
    return proc;
  });
  return proc;
}

beforeEach(() => {
  spawnMock.mockReset();
});

// ---------------------------------------------------------------------------
// ensureDockerPool — verifies --scale arg is passed
// ---------------------------------------------------------------------------

describe("ensureDockerPool", () => {
  it("passes --scale service=N in the compose up command", async () => {
    // compose up -> exit 0
    makeProcAsync(0);
    // docker compose ps -q (listPoolContainers) -> two IDs
    makeProcAsync(0, "abc123\ndef456\n");

    await ensureDockerPool("/compose.yml", "ralph-agent", 2, "/repo");

    const upCall = spawnMock.mock.calls.find((c: any[]) =>
      (c[1] as string[]).includes("up"),
    );
    expect(upCall).toBeTruthy();
    const upArgs = upCall![1] as string[];
    const scaleIdx = upArgs.indexOf("--scale");
    expect(scaleIdx).toBeGreaterThan(-1);
    expect(upArgs[scaleIdx + 1]).toBe("ralph-agent=2");
  });

  it("throws when compose up returns non-zero exit", async () => {
    makeProcAsync(1);

    await expect(ensureDockerPool("/compose.yml", "ralph-agent", 2, "/repo")).rejects.toThrow(
      "Failed to scale",
    );
  });
});

// ---------------------------------------------------------------------------
// listPoolContainers — ordering
// ---------------------------------------------------------------------------

describe("listPoolContainers", () => {
  it("returns ordered container IDs from docker compose ps -q output", async () => {
    makeProcAsync(0, "id1\nid2\nid3\n");

    const ids = await listPoolContainers("/compose.yml", "ralph-agent", "/repo");
    expect(ids).toEqual(["id1", "id2", "id3"]);
  });

  it("returns empty array when command fails", async () => {
    makeProcAsync(1);

    const ids = await listPoolContainers("/compose.yml", "ralph-agent", "/repo");
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DockerPool — acquire / release
// ---------------------------------------------------------------------------

describe("DockerPool", () => {
  it("returns slots 0..N-1 on acquire", async () => {
    const pool = new DockerPool(3);
    pool.init();

    const s0 = await pool.acquire();
    const s1 = await pool.acquire();
    const s2 = await pool.acquire();

    expect(new Set([s0, s1, s2])).toEqual(new Set([0, 1, 2]));
  });

  it("blocks acquire when all slots exhausted; resolves after release", async () => {
    const pool = new DockerPool(1);
    pool.init();

    const slot = await pool.acquire();
    expect(slot).toBe(0);

    let resolved = false;
    const pending = pool.acquire().then((s) => {
      resolved = true;
      return s;
    });

    // Not resolved yet
    expect(resolved).toBe(false);

    pool.release(slot);
    const next = await pending;
    expect(resolved).toBe(true);
    expect(next).toBe(0);
  });

  it("stopAll resolves pending acquires with sentinel -1", async () => {
    const pool = new DockerPool(1);
    pool.init();

    // Exhaust the pool
    await pool.acquire();

    // Queue a waiter
    const waiting = pool.acquire();
    pool.stopAll();

    const result = await waiting;
    expect(result).toBe(-1);
  });

  it("release returns slot to next waiter if queue is non-empty", async () => {
    const pool = new DockerPool(2);
    pool.init();

    const a = await pool.acquire();
    const b = await pool.acquire();

    // Both slots taken; queue a third waiter
    const waitingC = pool.acquire();

    pool.release(a);
    const c = await waitingC;
    expect(c).toBe(a);
    pool.release(b);
  });
});
