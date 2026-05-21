import { splitLogLine } from "./logTags";
import { parseToolLine } from "./parseToolLine";
import { parseCopilotFunctionCall } from "../../shared/copilotLogFormat";

/** Plan / dev / QA — same values as `RunStateFromLog.phase`. */
export type LoopPhase = "plan" | "dev" | "qa";

export type RunStateFromLog = {
  phase: LoopPhase;
  taskLine: string;
  iter: string | null;
  writes: number;
  reads: number;
  /** Per-verb `tool` call counts (olv stderr `tool <verb> {…}`). */
  toolCounts: Record<string, number>;
  /** Sum of `toolCounts` for verbs that look like MCP (`alias__name`). */
  mcpCalls: number;
};

export type TaskAnchor = {
  lineIndex: number;
  taskLine: string;
  iter: string | null;
  /** Dev vs QA from the `[task]` banner text. */
  phase: "dev" | "qa";
};

export type DeriveRunStateRange = {
  /** Inclusive start index into `lines`. */
  from?: number;
  /** Exclusive end index into `lines`. */
  to?: number;
};

/** Sum of counts for verbs containing `__` (MCP namespacing in olv). */
export function mcpCallsFromToolCounts(
  toolCounts: Record<string, number>,
): number {
  let n = 0;
  for (const [verb, c] of Object.entries(toolCounts)) {
    if (verb.includes("__")) n += c;
  }
  return n;
}

/**
 * One-line summary for a tooltip: `read_file: 2, method__x: 1` (sorted by count desc).
 */
export function toolCountsSummaryLine(
  toolCounts: Record<string, number>,
): string {
  const entries = Object.entries(toolCounts).filter(([, c]) => c > 0);
  if (entries.length === 0) return "";
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.map(([k, c]) => `${k}: ${c}`).join(", ");
}

/** Parse `[ralph] Dev iteration #n for task #id: title` (and resume lines). */
export function parseRalphTaskAnchor(body: string): {
  taskLine: string;
  iter: string | null;
  phase: "dev" | "qa";
} | null {
  const dev = body.match(/Dev iteration #(\d+) for task #(\d+):\s*(.+)/);
  if (dev) {
    return {
      taskLine: `Task #${dev[2]} · ${dev[3]!.trim()}`,
      iter: `Dev turn ${dev[1]}`,
      phase: "dev",
    };
  }
  const resume = body.match(/Resuming (QA|dev) for task #(\d+):\s*(.+)/i);
  if (resume) {
    const isQa = resume[1]!.toLowerCase() === "qa";
    return {
      taskLine: `Task #${resume[2]} · ${resume[3]!.trim()}`,
      iter: isQa ? "QA (resumed)" : "Dev (resumed)",
      phase: isQa ? "qa" : "dev",
    };
  }
  return null;
}

/** Parse `[task] ▶ Dev iteration … · Task #n · title` (or QA pass). */
export function parseTaskBanner(body: string): {
  taskLine: string;
  iter: string | null;
  phase: "dev" | "qa";
} | null {
  const tid = body.match(/Task #(\d+)/);
  if (!tid) return null;
  const dm = body.match(/Dev iteration\s+(\d+)/);
  const qm = body.match(/QA pass\s+(\d+)/);
  const isQa = /\bQA pass\b/.test(body) || /^[✦✧※⁕⁎]/.test(body);
  const afterTask = body.split(/Task #\d+\s*·\s*/)[1] ?? "";
  const title = afterTask.trim() || "—";
  return {
    taskLine: `Task #${tid[1]} · ${title}`,
    iter: dm ? `Dev turn ${dm[1]}` : qm ? `QA pass ${qm[1]}` : null,
    phase: isQa ? "qa" : "dev",
  };
}

/** All task banner rows in the log (`[task]` and `[ralph]` dev/resume lines). */
export function buildTaskAnchors(lines: string[]): TaskAnchor[] {
  const anchors: TaskAnchor[] = [];
  for (let i = 0; i < lines.length; i++) {
    const { tag, body } = splitLogLine(lines[i]!);
    if (tag === "[task]") {
      const parsed = parseTaskBanner(body);
      if (parsed) anchors.push({ lineIndex: i, ...parsed });
      continue;
    }
    if (tag === "[ralph]") {
      const parsed = parseRalphTaskAnchor(body);
      if (parsed) anchors.push({ lineIndex: i, ...parsed });
    }
  }
  return anchors;
}

/** Latest `[task]` / `[ralph]` anchor for a specific task id. */
export function pickTaskAnchorForTaskId(
  anchors: TaskAnchor[],
  taskId: number,
): TaskAnchor | null {
  if (taskId <= 0 || anchors.length === 0) return null;
  let last: TaskAnchor | null = null;
  for (const a of anchors) {
    const m = a.taskLine.match(/Task #(\d+)/);
    if (m && Number(m[1]) === taskId) last = a;
  }
  return last;
}

/** Exclusive end index for a task segment (next different-task banner, or log end). */
export function taskSegmentEndIndex(
  anchors: TaskAnchor[],
  taskId: number,
  segStart: number,
  lineCount: number,
): number {
  for (const a of anchors) {
    if (a.lineIndex <= segStart) continue;
    const m = a.taskLine.match(/Task #(\d+)/);
    if (m && Number(m[1]) !== taskId) return a.lineIndex;
  }
  return lineCount;
}

/** Last `[ralph] Planning iteration` at or before `beforeIndex`. */
export function findLastPlanningIndex(
  lines: string[],
  beforeIndex: number,
): number {
  let idx = 0;
  const end = Math.min(beforeIndex, lines.length - 1);
  for (let i = 0; i <= end; i++) {
    const { tag, body } = splitLogLine(lines[i]!);
    if (tag === "[ralph]" && /Planning iteration #\d+/.test(body)) {
      idx = i;
    }
  }
  return idx;
}

function bumpToolCount(toolCounts: Record<string, number>, verb: string): void {
  toolCounts[verb] = (toolCounts[verb] ?? 0) + 1;
}

function countCopilotToolName(name: string, stats: {
  writes: number;
  reads: number;
  toolCounts: Record<string, number>;
}): void {
  bumpToolCount(stats.toolCounts, name);
  if (name === "write_file" || name === "write" || name === "create" || name === "edit" || name === "edit_file" || name === "search_replace") {
    stats.writes++;
  } else if (name === "read_file" || name === "read" || name === "view" || name === "list_dir" || name === "grep") {
    stats.reads++;
  }
}

function countCopilotBody(body: string, stats: {
  writes: number;
  reads: number;
  toolCounts: Record<string, number>;
}): void {
  const segments = body.includes(" · ") ? body.split(" · ") : [body];
  for (const seg of segments) {
    const s = seg.trim();
    if (!s || s.startsWith("→ ") || s.startsWith("✓ ")) continue;
    const fn = parseCopilotFunctionCall(s);
    if (fn) {
      countCopilotToolName(fn.name, stats);
      continue;
    }
    if (/^write /.test(s)) {
      stats.writes++;
      bumpToolCount(stats.toolCounts, "write");
    } else if (/^read /.test(s) || /^edit /.test(s)) {
      if (/^read /.test(s)) stats.reads++;
      else stats.writes++;
      bumpToolCount(stats.toolCounts, s.split(/\s/)[0] ?? "tool");
    } else if (s.startsWith("$ ")) {
      bumpToolCount(stats.toolCounts, "bash");
    }
  }
}

function deriveRunStateFromSlice(slice: string[]): RunStateFromLog | null {
  if (slice.length === 0) return null;
  let phase: LoopPhase = "plan";
  let taskLine = "";
  let iter: string | null = null;
  let writes = 0;
  let reads = 0;
  let toolCounts: Record<string, number> = {};
  for (const line of slice) {
    const { tag, body } = splitLogLine(line);
    if (tag === "[ralph]" && /Planning iteration #\d+/.test(body)) {
      writes = 0;
      reads = 0;
      toolCounts = {};
      phase = "plan";
      taskLine = "";
      iter = null;
    }
    if (tag.startsWith("[olv:")) {
      if (tag.includes(":plan")) phase = "plan";
      if (tag.includes(":dev")) phase = "dev";
      if (tag.includes(":qa")) phase = "qa";
    }
    if (tag.startsWith("[vibe:") || tag.startsWith("[copilot:")) {
      if (tag.includes(":plan")) phase = "plan";
      if (tag.includes(":dev")) phase = "dev";
      if (tag.includes(":qa")) phase = "qa";
    }
    if (tag === "[dev]") {
      phase = "dev";
    }
    if (tag === "[qa]") {
      phase = "qa";
      if (/Running QA/i.test(body)) {
        const prev = (iter?.match(/QA pass (\d+)/)?.[1] ?? "0");
        const n = Number(prev) + 1;
        iter = `QA pass ${n}`;
      }
    }
    if (tag === "[ralph]") {
      const ralphTask = parseRalphTaskAnchor(body);
      if (ralphTask) {
        phase = ralphTask.phase;
        iter = ralphTask.iter;
        taskLine = ralphTask.taskLine;
      }
    }
    if (tag === "[task]") {
      const parsed = parseTaskBanner(body);
      if (parsed) {
        taskLine = parsed.taskLine;
        iter = parsed.iter;
        phase = parsed.phase;
      }
    }
    if (tag.startsWith("[olv:")) {
      const t = parseToolLine(body);
      if (t.kind === "tool") {
        const v = t.verb;
        bumpToolCount(toolCounts, v);
        if (v === "write_file" || v === "edit_file") {
          writes++;
        }
        if (v === "read_file" || v === "list_dir" || v === "grep") {
          reads++;
        }
      }
    }
    if (tag.startsWith("[copilot:")) {
      const copilotStats = { writes, reads, toolCounts };
      countCopilotBody(body, copilotStats);
      writes = copilotStats.writes;
      reads = copilotStats.reads;
      toolCounts = copilotStats.toolCounts;
    }
  }
  return {
    phase,
    taskLine,
    iter,
    writes,
    reads,
    toolCounts,
    mcpCalls: mcpCallsFromToolCounts(toolCounts),
  };
}

/**
 * Best-effort “where am I” from a slice of the log stream.
 */
export function deriveRunStateFromLines(
  lines: string[],
  range?: DeriveRunStateRange,
): RunStateFromLog | null {
  if (lines.length === 0) return null;
  const from = Math.max(0, range?.from ?? 0);
  const to = Math.min(lines.length, range?.to ?? lines.length);
  if (from >= to) return null;
  return deriveRunStateFromSlice(lines.slice(from, to));
}

/**
 * Sticky run header: always `taskId` from the loop (not scroll position).
 * Phase/stats from that task’s log segment through the tail; title from the app
 * when the task is not in the stream yet.
 */
export function deriveRunStateForCurrentTask(
  lines: string[],
  taskId: number,
  taskTitle?: string,
): RunStateFromLog | null {
  if (lines.length === 0) return null;
  const focus = lines.length - 1;
  const anchors = buildTaskAnchors(lines);
  const anchor = taskId > 0 ? pickTaskAnchorForTaskId(anchors, taskId) : null;
  const planStart = findLastPlanningIndex(lines, focus);
  const segStart = anchor?.lineIndex ?? planStart;
  const from = Math.min(segStart, planStart);
  const segEnd = anchor && taskId > 0
    ? taskSegmentEndIndex(anchors, taskId, segStart, lines.length)
    : lines.length;
  const to = Math.min(focus + 1, Math.max(from + 1, segEnd));
  const state = deriveRunStateFromLines(lines, { from, to });
  if (!state) return null;
  if (anchor) {
    state.taskLine = anchor.taskLine;
  } else if (taskId > 0) {
    state.taskLine = taskTitle
      ? `Task #${taskId} · ${taskTitle}`
      : `Task #${taskId}`;
  }
  return state;
}
