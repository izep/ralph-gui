import { chmod, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RalphLoop } from "./ralph-loop.js";
import { DEFAULT_SETTINGS } from "./templates.js";

const stubPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/poc-copilot-stub.sh",
);

describe("headless exit POC (stub Copilot)", () => {
  let tmpDir: string;
  let loop: RalphLoop | undefined;
  const prevBin = process.env.COPILOT_BIN;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "ralph-poc-exit-"));
    await chmod(stubPath, 0o755);
    process.env.COPILOT_BIN = stubPath;
  });

  afterEach(async () => {
    if (loop) {
      loop.stop();
      await loop.shutdown();
    }
    if (prevBin === undefined) delete process.env.COPILOT_BIN;
    else process.env.COPILOT_BIN = prevBin;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("stops the loop when the stub reports the epic complete", async () => {
    const statuses: string[] = [];
    loop = new RalphLoop(tmpDir, {
      onLog: () => { },
      onLoopStatus: (status) => {
        statuses.push(status);
      },
      onTasksUpdated: () => { },
    });
    await loop.bootstrap();
    await loop.writeEpic(`---
name: Headless exit POC
status: pending
---

# Headless exit
`);
    await writeFile(path.join(tmpDir, "requirements.md"), "# POC\n\nExit when done.\n", "utf-8");
    await loop.writeSettings({
      ...DEFAULT_SETTINGS,
      agentBackend: "copilot",
      minBacklogSize: 0,
      maxLLMCalls: 5,
      useDocker: false,
      pauseAfterPlan: false,
    });

    expect((await loop.start()).ok).toBe(true);
    await vi.waitFor(() => expect(loop!.didCompleteEpic).toBe(true), { timeout: 10_000 });
    await vi.waitFor(() => expect(loop!.isRunning).toBe(false), { timeout: 10_000 });
    expect(statuses).toContain("idle");
    expect(statuses).not.toContain("error");
  });
});
