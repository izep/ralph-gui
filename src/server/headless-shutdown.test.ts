import { describe, expect, it } from "vitest";
import { headlessShutdownForLoopStatus } from "./headless-shutdown.js";

describe("headlessShutdownForLoopStatus", () => {
  it("exits 0 when the epic completed", () => {
    expect(headlessShutdownForLoopStatus("idle", true)).toEqual({
      reason: "epic-complete",
      exitCode: 0,
    });
  });

  it("exits 0 when the loop idles without completing (max LLM / pause)", () => {
    expect(headlessShutdownForLoopStatus("idle", false)).toEqual({
      reason: "loop-finished",
      exitCode: 0,
    });
  });

  it("exits 1 on loop error so headless does not hang", () => {
    expect(headlessShutdownForLoopStatus("error", false)).toEqual({
      reason: "loop-error",
      exitCode: 1,
    });
  });

  it("does not exit while running or after a user stop", () => {
    expect(headlessShutdownForLoopStatus("running", false)).toBeNull();
    expect(headlessShutdownForLoopStatus("stopped", false)).toBeNull();
  });
});
