import { describe, expect, it } from "vitest";
import {
  buildTaskAnchors,
  deriveRunStateForCurrentTask,
  deriveRunStateFromLines,
  mcpCallsFromToolCounts,
  parseRalphTaskAnchor,
  pickTaskAnchorForTaskId,
  toolCountsSummaryLine,
} from "./runStateFromLog";

describe("deriveRunStateFromLines", () => {
  it("tracks phase from [vibe:…] tags like [olv:…]", () => {
    const lines = [
      "[ralph] Planning iteration #1...",
      "[vibe:plan] something",
      "[vibe:dev] tool read_file {}",
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s!.phase).toBe("dev");
  });

  it("aggregates list_dir/read / write and surfaces last task line", () => {
    const lines = [
      "[ralph] Planning iteration #1...",
      "[task] ▶ Dev iteration 1 · Task #3 · X",
      '[olv:dev] tool list_dir {"path":"."}',
      '[olv:dev] tool read_file {"path":"a.ts","content":""}',
      '[olv:dev] tool write_file {"path":"a.ts","content":"x\\n"}',
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s).not.toBeNull();
    expect(s!.taskLine).toContain("Task #3");
    expect(s!.phase).toBe("dev");
    expect(s!.reads).toBe(2);
    expect(s!.writes).toBe(1);
    expect(s!.toolCounts).toEqual({
      list_dir: 1,
      read_file: 1,
      write_file: 1,
    });
    expect(s!.mcpCalls).toBe(0);
  });

  it("counts tools when process-runner prefixes [olv:phase] onto olv’s [olv:tools] line", () => {
    const lines = [
      "[task] ▶ Dev iteration 1 · Task #3 · StorageAccessor [FR-7.1]",
      '[olv:dev] [olv:tools] tool list_dir {"path":".","entries":[]}',
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s).not.toBeNull();
    expect(s!.reads).toBe(1);
    expect(s!.toolCounts.list_dir).toBe(1);
  });

  it("counts MCP tools (verbs with __) and per-verb tallies", () => {
    const lines = [
      '[olv:dev] tool read_file {"path":"a.ts","content":""}',
      '[olv:dev] tool method__validate_call_chain {"x":1}',
      '[olv:qa] tool method__validate_call_chain {"x":2}',
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s!.toolCounts).toEqual({
      read_file: 1,
      method__validate_call_chain: 2,
    });
    expect(s!.mcpCalls).toBe(2);
  });

  it("counts copilot view/create style tool lines", () => {
    const lines = [
      "[ralph] Planning iteration #1...",
      '[copilot:dev] read src/App.tsx · write src/types.ts',
      '[copilot:dev] view({"path":"/x/out"})',
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s!.reads).toBeGreaterThanOrEqual(2);
    expect(s!.writes).toBeGreaterThanOrEqual(1);
    expect(s!.toolCounts.view).toBe(1);
  });

  it("resets toolCounts and mcpCalls on planning iteration", () => {
    const lines = [
      '[olv:dev] tool method__x {"a":1}',
      "[ralph] Planning iteration #2...",
      '[olv:plan] tool read_file {"path":"b.ts","content":""}',
    ];
    const s = deriveRunStateFromLines(lines);
    expect(s!.toolCounts).toEqual({ read_file: 1 });
    expect(s!.mcpCalls).toBe(0);
    expect(s!.writes).toBe(0);
  });
});

describe("parseRalphTaskAnchor", () => {
  it("parses dev iteration lines", () => {
    const p = parseRalphTaskAnchor(
      "Dev iteration #2 for task #5: Add storage",
    );
    expect(p?.taskLine).toBe("Task #5 · Add storage");
    expect(p?.iter).toBe("Dev turn 2");
    expect(p?.phase).toBe("dev");
  });
});

describe("buildTaskAnchors", () => {
  it("includes [ralph] dev iteration banners", () => {
    const lines = [
      "[ralph] Dev iteration #1 for task #2: Beta",
      '[copilot:dev] read src/a.ts',
    ];
    const anchors = buildTaskAnchors(lines);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.taskLine).toContain("Task #2");
  });
});

describe("pickTaskAnchorForTaskId", () => {
  it("returns the latest anchor for the requested task", () => {
    const lines = [
      "[ralph] Dev iteration #1 for task #1: A",
      "[ralph] Dev iteration #1 for task #2: B",
      "[task] ✦ QA pass 1 · Task #2 · B",
    ];
    const anchors = buildTaskAnchors(lines);
    const a = pickTaskAnchorForTaskId(anchors, 2);
    expect(a?.phase).toBe("qa");
    expect(a?.taskLine).toContain("Task #2");
  });
});

describe("deriveRunStateForCurrentTask", () => {
  it("tracks the requested task through the log tail", () => {
    const lines = [
      "[ralph] Dev iteration #1 for task #1: First",
      '[olv:dev] tool read_file {"path":"a.ts","content":""}',
      "[ralph] Dev iteration #1 for task #2: Second",
      '[olv:dev] tool write_file {"path":"b.ts","content":"x"}',
    ];
    const s = deriveRunStateForCurrentTask(lines, 1);
    expect(s!.taskLine).toContain("Task #1");
    expect(s!.reads).toBe(1);
    expect(s!.writes).toBe(0);

    const s2 = deriveRunStateForCurrentTask(lines, 2);
    expect(s2!.taskLine).toContain("Task #2");
    expect(s2!.writes).toBe(1);
  });

  it("uses app title when the task is not in the log yet", () => {
    const lines = ["[ralph] Planning iteration #1..."];
    const s = deriveRunStateForCurrentTask(lines, 4, "Future work");
    expect(s!.taskLine).toBe("Task #4 · Future work");
    expect(s!.phase).toBe("plan");
  });

  it("shows QA when the log tail is in QA even after a dev banner", () => {
    const lines = [
      "[ralph] Resuming QA for task #1: Scaffold",
      "[ralph] Dev iteration #1 for task #1: Scaffold",
      "[qa] Running QA agent...",
      "[copilot:qa] → checking",
    ];
    const s = deriveRunStateForCurrentTask(lines, 1);
    expect(s!.phase).toBe("qa");
    expect(s!.iter).toMatch(/QA pass/);
  });
});

describe("mcpCallsFromToolCounts", () => {
  it("sums only __ verbs", () => {
    expect(
      mcpCallsFromToolCounts({
        read_file: 3,
        method__a: 2,
        method__b: 1,
      }),
    ).toBe(3);
  });
});

describe("toolCountsSummaryLine", () => {
  it("sorts by count desc then name", () => {
    expect(
      toolCountsSummaryLine({ a: 1, b: 3, c: 2 }),
    ).toBe("b: 3, c: 2, a: 1");
  });

  it("returns empty for empty or zero-only", () => {
    expect(toolCountsSummaryLine({})).toBe("");
    expect(toolCountsSummaryLine({ x: 0 })).toBe("");
  });
});
