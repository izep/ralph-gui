import { describe, expect, it } from "vitest";
import {
  isHeartbeatLine,
  shouldOmitLogLine,
  shouldSuppressCopilotSplitDedup,
} from "./logLineFilters";

describe("logLineFilters", () => {
  it("detects heartbeat meta lines", () => {
    expect(
      isHeartbeatLine("[olv:plan] meta: … 1m 2s (idle 0s)"),
    ).toBe(true);
  });

  it("suppresses split segments after combined copilot line", () => {
    const lines = [
      "[copilot:dev] read a.ts · $ npm test",
      "[copilot:dev] read a.ts",
      "[copilot:dev] $ npm test",
    ];
    expect(shouldSuppressCopilotSplitDedup(lines, 1)).toBe(true);
    expect(shouldSuppressCopilotSplitDedup(lines, 2)).toBe(true);
    expect(shouldSuppressCopilotSplitDedup(lines, 0)).toBe(false);
  });

  it("omits heartbeat via shouldOmitLogLine", () => {
    const lines = ["[olv:dev] meta: … 30s (idle 1s)"];
    expect(shouldOmitLogLine(lines, 0)).toBe(true);
  });
});
