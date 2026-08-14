import {
  parseJsonTaskList,
  type ParsedTaskListItem,
} from "../../shared/parseTaskList";

export type { ParsedTaskListItem } from "../../shared/parseTaskList";

export type ToolParseResult =
  | {
    kind: "tool";
    verb: string;
    target: string;
    delta: string;
    argsJson: string;
  }
  | { kind: "opaque"; raw: string };

/** Extract a balanced JSON object starting at `fromIdx` (must be `{`). */
function extractFirstJsonObject(text: string, fromIdx: number): string | null {
  if (text[fromIdx] !== "{") return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = fromIdx; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(fromIdx, i + 1);
    }
  }
  return null;
}

function pathFromArgs(args: Record<string, unknown>): string {
  const p =
    (typeof args["path"] === "string" && args["path"])
      || (typeof args["file_path"] === "string" && args["file_path"])
      || (typeof args["filepath"] === "string" && args["filepath"])
      || "";
  return p;
}

function lineCountDelta(content: string): string {
  if (content.length === 0) return "+0 lines";
  const n = content.split("\n").length;
  return `+${n} line${n === 1 ? "" : "s"}`;
}

function deriveDelta(verb: string, args: Record<string, unknown>): string {
  switch (verb) {
    case "write_file":
    case "edit_file": {
      const c = typeof args["content"] === "string" ? args["content"] : "";
      return lineCountDelta(c);
    }
    case "read_file": {
      const c = typeof args["content"] === "string" ? args["content"] : "";
      if (c) {
        const bytes = new TextEncoder().encode(c).length;
        return `${bytes} B`;
      }
      return "";
    }
    case "list_dir": {
      const parts: string[] = [];
      const entries = args["entries"];
      if (Array.isArray(entries)) {
        parts.push(
          `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`,
        );
      }
      const dep = args["depth"];
      if (typeof dep === "number" && Number.isFinite(dep)) {
        parts.push(`depth ${dep}`);
      }
      return parts.join(" · ");
    }
    case "grep": {
      const matches = args["matches"];
      if (Array.isArray(matches)) {
        return `${matches.length} match${matches.length === 1 ? "" : "es"}`;
      }
      const m = args["match_count"];
      if (typeof m === "number") {
        return `${m} match${m === 1 ? "" : "es"}`;
      }
      return "";
    }
    case "run_command": {
      const cmd = typeof args["command"] === "string"
        ? args["command"]
        : typeof args["cmd"] === "string"
        ? args["cmd"]
        : "";
      if (cmd.length > 64) return cmd.slice(0, 61) + "…";
      return cmd;
    }
    default:
      return "";
  }
}

/**
 * Strips one or more leading bracket tags, e.g. when stderr is
 * `[olv:dev] [olv:tools] tool list_dir {…}` and {@link splitLogLine} only
 * removes the outer tag.
 */
function stripLeadingLogTags(s: string): string {
  let t = s.trim();
  for (;;) {
    const m = t.match(/^\[[^\]]+]\s*/);
    if (!m) break;
    t = t.slice(m[0]!.length).trimStart();
  }
  return t;
}

/**
 * Parse olv stderr body: `tool write_file {"path":"…","content":"…"}`.
 * Body is the part after the log tag (e.g. `[olv:dev] `), optionally with
 * nested stream tags from olv (e.g. `[olv:tools] tool …`).
 */
export function parseToolLine(body: string): ToolParseResult {
  const trimmed = stripLeadingLogTags(body);
  const toolMatch = trimmed.match(/^tool\s+([a-zA-Z0-9_]+)\s+/);
  if (!toolMatch) {
    return { kind: "opaque", raw: trimmed };
  }
  const verb = toolMatch[1]!;
  const afterVerb = trimmed.slice(toolMatch[0].length);
  const j0 = afterVerb.indexOf("{");
  if (j0 < 0) {
    return { kind: "opaque", raw: trimmed };
  }
  const jsonStr = extractFirstJsonObject(afterVerb, j0);
  if (!jsonStr) {
    return { kind: "opaque", raw: trimmed };
  }
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return { kind: "opaque", raw: trimmed };
  }
  let target = pathFromArgs(args) || deriveTargetFallback(verb, args);
  if (verb === "report_intent") {
    const intent = typeof args["intent"] === "string" ? args["intent"].trim() : "";
    target = intent.length > 80 ? intent.slice(0, 77) + "…" : intent;
  }
  if (verb === "list_dir" && !target) {
    target = ".";
  }
  const delta = deriveDelta(verb, args);
  return {
    kind: "tool",
    verb,
    target,
    delta,
    argsJson: jsonStr,
  };
}

/** Pretty-prints tool JSON for the log expando; falls back to the raw string on parse failure. */
export function formatToolArgsJsonForDisplay(argsJson: string): string {
  try {
    const o = JSON.parse(argsJson) as unknown;
    return JSON.stringify(o, null, 2);
  } catch {
    return argsJson;
  }
}

function deriveTargetFallback(verb: string, args: Record<string, unknown>): string {
  if (verb === "run_command") {
    const c = typeof args["command"] === "string" ? args["command"] : "";
    return c ? (c.length > 80 ? c.slice(0, 77) + "…" : c) : "";
  }
  if (verb === "grep") {
    const pat = typeof args["pattern"] === "string" ? args["pattern"] : "";
    return pat;
  }
  return "";
}

export type PlanResponseParseResult =
  | {
    kind: "plan-response";
    tasks: ParsedTaskListItem[];
    rawLine: string;
    rawJson: string;
  }
  | { kind: "plan-raw"; rawLine: string; rawJson: string; parseNote?: string };

const PLAN_RESULT_TAGS = new Set(["[olv:plan:stdout]", "[olv:plan:result]"]);

/**
 * Detect a full log line whose tag is plan stdout/result and body is olv JSON envelope.
 */
export function parsePlanResponseLine(
  line: string,
): PlanResponseParseResult | null {
  const m = line.match(/^(\[[^\]]+\])\s*([\s\S]*)$/s);
  if (!m) return null;
  const tag = m[1]!;
  if (!PLAN_RESULT_TAGS.has(tag)) return null;
  const body = m[2] ?? "";
  const rawLine = line;
  const rawJson = body.trim();
  if (!rawJson.startsWith("{") && !rawJson.startsWith("[")) {
    return { kind: "plan-raw", rawLine, rawJson, parseNote: "non-json" };
  }
  let top: unknown;
  try {
    top = JSON.parse(rawJson) as unknown;
  } catch {
    return { kind: "plan-raw", rawLine, rawJson, parseNote: "json-parse" };
  }
  if (top === null || typeof top !== "object") {
    return { kind: "plan-raw", rawLine, rawJson };
  }
  const o = top as Record<string, unknown>;
  const responseField = o["response"];
  const textToScan =
    typeof responseField === "string"
      ? responseField
      : typeof o["raw"] === "string"
      ? (o["raw"] as string)
      : rawJson;
  const tasks = parseJsonTaskList(textToScan);
  return { kind: "plan-response", tasks, rawLine, rawJson };
}

export function isPlanEnvelopeTag(tag: string): boolean {
  return PLAN_RESULT_TAGS.has(tag);
}
