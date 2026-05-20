import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdtemp, rm } from "fs/promises";

// We need to mock child_process.spawn before importing docker-runner
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import { checkDockerHost, resolveComposeFile, buildDockerSpawn } from "./docker-runner.js";
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

  kill() {}

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
