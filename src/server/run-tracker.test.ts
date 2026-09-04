import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { parseAgentHeartbeat, RalphRunTracker } from "./run-tracker.js";

describe("parseAgentHeartbeat", () => {
  it("parses idle heartbeat lines including the kill budget", () => {
    expect(
      parseAgentHeartbeat(
        "[copilot:plan] meta: … 4m (idle 2m 16s; kill after 10m idle)",
      ),
    ).toEqual({
      tag: "copilot:plan",
      elapsed: "4m",
      idle: "2m 16s",
      idleKillAfter: "10m",
    });
  });

  it("parses heartbeats without an idle kill budget", () => {
    expect(parseAgentHeartbeat("[copilot:dev] meta: … 12s (idle 3s)")).toEqual({
      tag: "copilot:dev",
      elapsed: "12s",
      idle: "3s",
      idleKillAfter: null,
    });
  });

  it("returns null for non-heartbeat lines", () => {
    expect(parseAgentHeartbeat("[ralph] Planning iteration #1...")).toBeNull();
  });
});

describe("RalphRunTracker", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it("appends run.log and writes run-status.json from heartbeat lines", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ralph-run-"));
    const tracker = new RalphRunTracker(tmpDir);
    tracker.setLoopStatus("running");
    tracker.record("[copilot:plan] meta: … 1m (idle 20s; kill after 10m idle)");
    await tracker.flush();

    const statusRaw = await readFile(path.join(tmpDir, "run-status.json"), "utf-8");
    const status = JSON.parse(statusRaw) as {
      loopStatus: string;
      tag: string;
      elapsed: string;
      idle: string;
      idleKillAfter: string;
      lastLog: string;
    };
    expect(status.loopStatus).toBe("running");
    expect(status.tag).toBe("copilot:plan");
    expect(status.elapsed).toBe("1m");
    expect(status.idle).toBe("20s");
    expect(status.idleKillAfter).toBe("10m");
    expect(status.lastLog).toContain("kill after 10m idle");

    const log = await readFile(path.join(tmpDir, "run.log"), "utf-8");
    expect(log).toContain("[copilot:plan] meta:");
  });
});
