import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
vi.mock("fs", () => ({ existsSync: vi.fn() }));
import * as fs from "fs";

// We need to mock child_process.spawn before importing docker-runner
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import {
  checkDockerHost,
  resolveComposeFile,
  buildDockerSpawn,
  ensureDockerAgentRunning,
  resolveAgentCliInDockerContainer,
} from "./docker-runner.js";
import type { Settings } from "./settings-manager.js";

const DEFAULT_SETTINGS_PARTIAL: Pick<Settings, "dockerComposeFile"> = {
  dockerComposeFile: "",
};

class MockProcess {
  stdout = { on: vi.fn() };
  stderr = { on: vi.fn() };
  stdin = { end: vi.fn() };

  private errorHandlers: Array<(err: NodeJS.ErrnoException) => void> = [];
  private closeHandlers: Array<(code: number) => void> = [];

  on(event: string, handler: (...args: unknown[]) => void): this {
    if (event === "error") this.errorHandlers.push(handler as (err: NodeJS.ErrnoException) => void);
    if (event === "close") this.closeHandlers.push(handler as (code: number) => void);
    return this;
  }

  kill() { }

  emitError(err: NodeJS.ErrnoException) {
    this.errorHandlers.forEach((h) => h(err));
  }

  emitClose(code: number, stderrData?: string) {
    if (stderrData) {
      const stderrHandlers: Array<(d: Buffer) => void> = [];
      this.stderr.on.mock.calls
        .filter((c) => c[0] === "data")
        .forEach((c) => stderrHandlers.push(c[1] as (d: Buffer) => void));
      stderrHandlers.forEach((h) => h(Buffer.from(stderrData)));
    }
    this.closeHandlers.forEach((h) => h(code));
  }
}

function makeProc(): MockProcess {
  const proc = new MockProcess();
  spawnMock.mockReturnValueOnce(proc);
  return proc;
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "docker-runner-test-"));
  spawnMock.mockReset();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// checkDockerHost
// ---------------------------------------------------------------------------

describe("checkDockerHost", () => {
  it("returns not_installed when docker version command emits ENOENT", async () => {
    const proc = makeProc();
    const promise = checkDockerHost();
    const err = Object.assign(new Error("docker not found"), { code: "ENOENT" });
    proc.emitError(err);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_installed");
      expect(result.message).toMatch(/not installed/i);
    }
  });

  it("returns not_installed when docker version exits with code 127", async () => {
    const proc = makeProc();
    const promise = checkDockerHost();
    proc.emitClose(127);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_installed");
    }
  });

  it("returns not_running when docker info fails", async () => {
    // docker version succeeds
    const versionProc = makeProc();
    // docker info fails
    const infoProc = makeProc();

    const promise = checkDockerHost();
    // version ok
    versionProc.emitClose(0);
    // Wait for info call to be made
    await vi.waitFor(() => spawnMock.mock.calls.length >= 2);
    infoProc.emitClose(1, "Cannot connect to the Docker daemon");
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_running");
      expect(result.message).toMatch(/daemon/i);
    }
  });

  it("returns compose_missing when docker compose version fails", async () => {
    const versionProc = makeProc();
    const infoProc = makeProc();
    const composeProc = makeProc();

    const promise = checkDockerHost();
    versionProc.emitClose(0);
    await vi.waitFor(() => spawnMock.mock.calls.length >= 2);
    infoProc.emitClose(0);
    await vi.waitFor(() => spawnMock.mock.calls.length >= 3);
    composeProc.emitClose(1);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("compose_missing");
    }
  });

  it("returns ok when all checks pass", async () => {
    const versionProc = makeProc();
    const infoProc = makeProc();
    const composeProc = makeProc();

    const promise = checkDockerHost();
    versionProc.emitClose(0);
    await vi.waitFor(() => spawnMock.mock.calls.length >= 2);
    infoProc.emitClose(0);
    await vi.waitFor(() => spawnMock.mock.calls.length >= 3);
    composeProc.emitClose(0);
    const result = await promise;
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveComposeFile
// ---------------------------------------------------------------------------

describe("resolveComposeFile", () => {
  it("returns bundled path when dockerComposeFile is empty", () => {
    const result = resolveComposeFile(DEFAULT_SETTINGS_PARTIAL, "/repo", "/pkgroot");
    expect(result).toBe("/pkgroot/docker-compose.agents.yml");
  });

  it("returns bundled path when dockerComposeFile is whitespace only", () => {
    const result = resolveComposeFile({ dockerComposeFile: "   " }, "/repo", "/pkgroot");
    expect(result).toBe("/pkgroot/docker-compose.agents.yml");
  });

  it("returns path joined with repoRoot when relative", () => {
    const result = resolveComposeFile(
      { dockerComposeFile: "infra/compose.yml" },
      "/my/repo",
      "/pkgroot",
    );
    expect(result).toBe("/my/repo/infra/compose.yml");
  });

  it("returns absolute path as-is when override is absolute", () => {
    const result = resolveComposeFile(
      { dockerComposeFile: "/absolute/compose.yml" },
      "/my/repo",
      "/pkgroot",
    );
    expect(result).toBe("/absolute/compose.yml");
  });
});

// ---------------------------------------------------------------------------
// buildDockerSpawn
// ---------------------------------------------------------------------------

describe("buildDockerSpawn", () => {
  it("builds correct docker compose exec argv", () => {
    const spec = buildDockerSpawn(
      "/path/to/docker-compose.yml",
      "ralph-agent",
      "gh",
      ["copilot", "--autopilot"],
    );
    expect(spec.cmd).toBe("docker");
    expect(spec.args).toEqual([
      "compose",
      "-f",
      "/path/to/docker-compose.yml",
      "exec",
      "-T",
      "-w",
      "/workspace",
      "ralph-agent",
      "gh",
      "copilot",
      "--autopilot",
    ]);
  });

  it("works with empty command args", () => {
    const spec = buildDockerSpawn("/compose.yml", "service", "node", []);
    expect(spec.args).toEqual([
      "compose",
      "-f",
      "/compose.yml",
      "exec",
      "-T",
      "-w",
      "/workspace",
      "service",
      "node",
    ]);
  });
});

// ---------------------------------------------------------------------------
// ensureDockerAgentRunning
// ---------------------------------------------------------------------------

describe("ensureDockerAgentRunning", () => {
  function installComposeSpawnMock(handlers: {
    onPs?: () => { running: boolean; stdout?: string };
    onUp?: () => number;
    onExec?: () => { code: number; stdout?: string };
  }) {
    let psCalls = 0;
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockProcess();
      const finish = (fn: () => void) => queueMicrotask(fn);

      if (args.includes("up")) {
        finish(() => proc.emitClose(handlers.onUp?.() ?? 0));
      } else if (args.includes("ps")) {
        psCalls++;
        finish(() => {
          const ps = handlers.onPs?.() ?? { running: true, stdout: "ralph-agent\n" };
          if (ps.stdout) {
            emitStdout(proc, ps.stdout);
          }
          proc.emitClose(0);
        });
      } else if (args.includes("exec")) {
        finish(() => {
          const isCliProbe = args.some((a) => typeof a === "string" && a.includes("command -v"));
          const exec = handlers.onExec?.() ?? {
            code: 0,
            stdout: isCliProbe ? "/usr/local/bin/copilot\n" : "v20.0.0\n",
          };
          if (exec.stdout) emitStdout(proc, exec.stdout);
          proc.emitClose(exec.code);
        });
      } else if (args.includes("logs")) {
        finish(() => proc.emitClose(0));
      } else {
        finish(() => proc.emitClose(1));
      }
      return proc;
    });
    return { getPsCalls: () => psCalls };
  }

  function emitStdout(proc: MockProcess, text: string) {
    proc.stdout.on.mock.calls
      .filter((c) => c[0] === "data")
      .forEach((c) => (c[1] as (d: Buffer) => void)(Buffer.from(text)));
  }

  it("runs compose up, waits for running state, then probes the service", async () => {
    installComposeSpawnMock({});
    const logs: string[] = [];
    const result = await ensureDockerAgentRunning(
      "/compose.yml",
      "ralph-agent",
      "/repo",
      (l) => logs.push(l),
      "copilot",
    );

    expect(result.ok).toBe(true);
    expect(spawnMock.mock.calls.some((c) => (c[1] as string[]).includes("up"))).toBe(true);
    expect(spawnMock.mock.calls.some((c) => (c[1] as string[]).includes("ps"))).toBe(true);
    expect(spawnMock.mock.calls.some((c) => (c[1] as string[]).includes("exec"))).toBe(true);
    expect(logs.some((l) => l.includes("ready"))).toBe(true);
  });

  it("returns error when compose up fails", async () => {
    installComposeSpawnMock({ onUp: () => 1 });
    const result = await ensureDockerAgentRunning("/compose.yml", "ralph-agent", "/repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Failed to start/i);
    }
  });

  it("force-recreates when service never reaches running state", async () => {
    vi.useFakeTimers();
    installComposeSpawnMock({
      onPs: () => {
        const recreated = spawnMock.mock.calls.some((c) =>
          (c[1] as string[]).includes("--force-recreate"),
        );
        return recreated
          ? { running: true, stdout: "ralph-agent\n" }
          : { running: false, stdout: "" };
      },
    });

    const promise = ensureDockerAgentRunning("/compose.yml", "ralph-agent", "/repo");
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.ok).toBe(true);
    expect(
      spawnMock.mock.calls.some((c) => (c[1] as string[]).includes("--force-recreate")),
    ).toBe(true);
  });

  it("resolveAgentCliInDockerContainer returns path from command -v", async () => {
    installComposeSpawnMock({
      onExec: () => ({ code: 0, stdout: "/usr/local/bin/copilot\n" }),
    });
    const path = await resolveAgentCliInDockerContainer(
      "/compose.yml",
      "ralph-agent",
      "/repo",
      "copilot",
    );
    expect(path).toBe("/usr/local/bin/copilot");
    expect(
      spawnMock.mock.calls.some((c) =>
        (c[1] as string[]).some((a) => a.includes("command -v")),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildDockerSpawn — Epic 004 extensions (containerIndex, worktreeCwd)
// ---------------------------------------------------------------------------

describe("buildDockerSpawn with containerIndex", () => {
  it("inserts --index N before -T when containerIndex is provided", () => {
    const spec = buildDockerSpawn("/compose.yml", "ralph-agent", "gh", ["copilot"], {
      containerIndex: 1,
    });
    expect(spec.cmd).toBe("docker");
    const execIdx = spec.args.indexOf("exec");
    expect(spec.args[execIdx + 1]).toBe("--index");
    expect(spec.args[execIdx + 2]).toBe("1");
    expect(spec.args[execIdx + 3]).toBe("-T");
  });

  it("does NOT insert --index when containerIndex is not provided (regression)", () => {
    const spec = buildDockerSpawn("/compose.yml", "ralph-agent", "gh", ["copilot"]);
    expect(spec.args).not.toContain("--index");
    // Existing argv shape unchanged
    expect(spec.args).toEqual([
      "compose", "-f", "/compose.yml",
      "exec", "-T", "-w", "/workspace",
      "ralph-agent", "gh", "copilot",
    ]);
  });

  it("uses worktreeCwd instead of /workspace when provided", () => {
    const spec = buildDockerSpawn("/compose.yml", "ralph-agent", "node", [], {
      worktreeCwd: "/workspace/.ralph/worktrees/slot-2",
    });
    const wIdx = spec.args.indexOf("-w");
    expect(spec.args[wIdx + 1]).toBe("/workspace/.ralph/worktrees/slot-2");
  });

  it("combines containerIndex and worktreeCwd", () => {
    const spec = buildDockerSpawn("/compose.yml", "svc", "node", [], {
      containerIndex: 0,
      worktreeCwd: "/workspace/.ralph/worktrees/slot-0",
    });
    expect(spec.args).toContain("--index");
    expect(spec.args).toContain("0");
    const wIdx = spec.args.indexOf("-w");
    expect(spec.args[wIdx + 1]).toBe("/workspace/.ralph/worktrees/slot-0");
  });
});

// ---------------------------------------------------------------------------
// ensureDockerAgentRunning — missingClis and socket mount (Epic 004)
// ---------------------------------------------------------------------------

describe("ensureDockerAgentRunning — missingClis", () => {
  it("returns missingClis when a secondary backend CLI is not installed", async () => {
    // Use installComposeSpawnMock from the parent describe's scope isn't accessible here,
    // so we replicate the key behavior inline using spawnMock.
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockProcess();
      const emitStdout = (text: string) => {
        proc.stdout.on.mock.calls
          .filter((c) => c[0] === "data")
          .forEach((c) => (c[1] as (d: Buffer) => void)(Buffer.from(text)));
      };
      queueMicrotask(() => {
        if (args.includes("up")) {
          proc.emitClose(0);
        } else if (args.includes("ps")) {
          emitStdout("ralph-agent\n");
          proc.emitClose(0);
        } else if (args.includes("exec")) {
          // CLI probe: succeed for copilot, fail for claude
          const isCliProbe = args.some((a) => typeof a === "string" && a.includes("command -v"));
          const isClaudeProbe = args.some((a) => typeof a === "string" && a.includes("claude"));
          if (isCliProbe && isClaudeProbe) {
            proc.emitClose(1); // claude not found
          } else if (isCliProbe) {
            emitStdout("/usr/local/bin/copilot\n");
            proc.emitClose(0);
          } else {
            emitStdout("v22.0.0\n");
            proc.emitClose(0);
          }
        } else if (args.includes("logs")) {
          proc.emitClose(0);
        } else {
          proc.emitClose(0);
        }
      });
      return proc;
    });

    const result = await ensureDockerAgentRunning(
      "/compose.yml",
      "ralph-agent",
      "/repo",
      undefined,
      "copilot",
      { installedBackends: ["copilot", "claude"] },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.missingClis).toContain("claude");
    }
  });
});

// ---------------------------------------------------------------------------
// ensureDockerAgentRunning — validateSocketMount (Epic 004)
// ---------------------------------------------------------------------------

describe("ensureDockerAgentRunning — validateSocketMount", () => {
  beforeEach(() => {
    // reset the mocked fs.existsSync (vi.mock provided earlier)
    if (fs.existsSync?.mockReset) fs.existsSync.mockReset();
    spawnMock.mockReset();
  });

  afterEach(() => {
    if (fs.existsSync?.mockReset) fs.existsSync.mockReset();
    spawnMock.mockReset();
  });

  it("returns error when docker socket does not exist on host", async () => {
    if (fs.existsSync?.mockReturnValue) fs.existsSync.mockReturnValue(false);

    // Basic spawn behavior: up, ps, exec for node probe
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockProcess();
      const emitStdoutLocal = (text: string) => {
        proc.stdout.on.mock.calls
          .filter((c) => c[0] === "data")
          .forEach((c) => (c[1] as (d: Buffer) => void)(Buffer.from(text)));
      };
      queueMicrotask(() => {
        if (args.includes("up")) proc.emitClose(0);
        else if (args.includes("ps")) {
          emitStdoutLocal("ralph-agent\n");
          proc.emitClose(0);
        } else if (args.includes("exec")) {
          emitStdoutLocal("v22.0.0\n");
          proc.emitClose(0);
        } else proc.emitClose(0);
      });
      return proc;
    });

    const result = await ensureDockerAgentRunning(
      "/compose.yml",
      "ralph-agent",
      "/repo",
      undefined,
      "copilot",
      { validateSocketMount: true },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Docker socket not found/);
    }
  });

  it("validates docker info and docker compose version inside container when socket present", async () => {
    if (fs.existsSync?.mockReturnValue) fs.existsSync.mockReturnValue(true);

    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockProcess();
      const emitStdoutLocal = (text: string) => {
        proc.stdout.on.mock.calls
          .filter((c) => c[0] === "data")
          .forEach((c) => (c[1] as (d: Buffer) => void)(Buffer.from(text)));
      };
      queueMicrotask(() => {
        if (args.includes("up")) proc.emitClose(0);
        else if (args.includes("ps")) {
          emitStdoutLocal("ralph-agent\n");
          proc.emitClose(0);
        } else if (args.includes("exec")) {
          // Return success for node probe, docker info and docker compose version
          emitStdoutLocal("ok\n");
          proc.emitClose(0);
        } else proc.emitClose(0);
      });
      return proc;
    });

    const result = await ensureDockerAgentRunning(
      "/compose.yml",
      "ralph-agent",
      "/repo",
      undefined,
      "copilot",
      { validateSocketMount: true },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.missingClis).toBeUndefined();
    }
  });
});
