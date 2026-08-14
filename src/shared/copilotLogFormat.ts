import { parseJsonTaskList } from "./parseTaskList.js";

export const CONTENT_PREVIEW_LEN = 300;
export const TOOL_PREVIEW_LEN = 120;

export function previewText(text: string, max = CONTENT_PREVIEW_LEN): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "..." : t;
}

function shortPath(path: string): string {
  const p = path.replace(/\\/g, "/");
  const parts = p.split("/").filter(Boolean);
  return parts.length >= 2
    ? parts.slice(-2).join("/")
    : parts[parts.length - 1] ?? path;
}

function pathFromArgs(args: Record<string, unknown>): string | null {
  const p = args.path ?? args.file_path ?? args.filepath;
  return typeof p === "string" && p.trim() ? shortPath(p.trim()) : null;
}

/**
 * One tool invocation as logged by Copilot JSONL formatters (server + client).
 */
export function formatCopilotToolRequest(
  name: string,
  args: Record<string, unknown>,
): string {
  if (name === "bash" && typeof args.command === "string") {
    const cmd = args.command;
    return `$ ${cmd.length > TOOL_PREVIEW_LEN ? cmd.slice(0, TOOL_PREVIEW_LEN) + "..." : cmd}`;
  }
  const path = pathFromArgs(args);
  if (name === "view" && path) return `read ${path}`;
  if (name === "create" && path) return `write ${path}`;
  if (name === "edit" && path) return `edit ${path}`;
  if (name === "task_complete") {
    const summary = typeof args.summary === "string"
      ? previewText(args.summary, TOOL_PREVIEW_LEN)
      : "";
    return summary ? `✓ ${summary}` : "✓ task complete";
  }
  if (name === "report_intent") {
    const intent = typeof args.intent === "string" ? args.intent.trim() : "";
    return intent ? `Intent · ${intent}` : "Intent";
  }
  if (
    (name === "write_file" || name === "read_file" || name === "search_replace")
    && path
  ) {
    const verb = name === "read_file"
      ? "read"
      : name === "write_file"
      ? "write"
      : "edit";
    return `${verb} ${path}`;
  }
  const summary = JSON.stringify(args);
  return `${name}(${summary.length > 80 ? summary.slice(0, 80) + "..." : summary})`;
}

/** Summarize tool result text from `tool.execution_complete`. */
export function summarizeCopilotToolResult(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "—";
  if (t.startsWith("diff --git")) {
    const m = t.match(/diff --git a\/\S+ b\/(\S+)/)
      ?? t.match(/\+\+\+ b\/(\S+)/);
    if (m?.[1]) return `read ${shortPath(m[1])} (diff)`;
    return "file diff";
  }
  if (t.startsWith("{") && /"tasks"\s*:/.test(t)) {
    try {
      const o = JSON.parse(t) as { tasks?: unknown[] };
      if (Array.isArray(o.tasks) && o.tasks.length > 0) {
        return `tasks · ${o.tasks.length} item${o.tasks.length === 1 ? "" : "s"}`;
      }
    } catch {
      /* fall through */
    }
    const tasks = parseJsonTaskList(t);
    if (tasks.length > 0) {
      return `tasks · ${tasks.length} item${tasks.length === 1 ? "" : "s"}`;
    }
    const ids = (t.match(/"id"\s*:/g) ?? []).length;
    if (ids > 0) return `tasks · ~${ids} items`;
  }
  if (t.startsWith("{") && /"name"\s*:/.test(t) && /"scripts"\s*:/.test(t)) {
    return "package.json";
  }
  if (/^<exited with exit code \d+>/i.test(t)) return t;
  return previewText(t, TOOL_PREVIEW_LEN);
}

function extractFirstJsonObject(text: string, fromIdx: number): string | null {
  if (text[fromIdx] !== "{") return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = fromIdx; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inString = false;
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

/** Parse `name({...})` Copilot-style function call segments. */
export function parseCopilotFunctionCall(
  segment: string,
): { name: string; args: Record<string, unknown> } | null {
  const m = segment.trim().match(/^([a-zA-Z_][\w]*)\s*\(/);
  if (!m) return null;
  const name = m[1]!;
  const paren = segment.indexOf("(");
  const j0 = segment.indexOf("{", paren);
  if (j0 < 0) return null;
  const jsonStr = extractFirstJsonObject(segment, j0);
  if (!jsonStr) return null;
  try {
    const args = JSON.parse(jsonStr) as Record<string, unknown>;
    return { name, args };
  } catch {
    return null;
  }
}

/** Humanize one segment from a combined ` · ` copilot log body. */
export function humanizeCopilotLogSegment(segment: string): string {
  const s = segment.trim();
  if (!s) return s;
  if (s.startsWith("→ ") || s.startsWith("✓ ")) return s;
  if (s.startsWith("$ ")) return s;
  if (/^Intent · /.test(s)) return s;

  const fn = parseCopilotFunctionCall(s);
  if (fn) return formatCopilotToolRequest(fn.name, fn.args);

  if (looksLikeReportIntentCall(s)) {
    const ri = humanizeReportIntentCall(s);
    if (ri) return ri;
  }

  const fence = s.match(/```json[\s\S]*?```/);
  if (fence) {
    const tasks = parseJsonTaskList(s);
    if (tasks.length > 0) {
      return `Plan draft · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
    }
  }

  if (s.length > CONTENT_PREVIEW_LEN) {
    return previewText(s);
  }
  return s;
}

export function looksLikeReportIntentCall(text: string): boolean {
  return /^report_intent\s*\(/i.test(text.trim());
}

export function humanizeReportIntentCall(text: string): string | null {
  const fn = parseCopilotFunctionCall(text.trim());
  if (fn?.name === "report_intent") {
    return formatCopilotToolRequest("report_intent", fn.args);
  }
  return null;
}

/** Split combined copilot bodies and humanize each segment. */
export function humanizeCombinedCopilotBody(body: string): string {
  if (!body.includes(" · ")) {
    return humanizeCopilotLogSegment(body);
  }
  return body
    .split(" · ")
    .map((part) => humanizeCopilotLogSegment(part))
    .join(" · ");
}

export function previewAssistantContent(content: string): string {
  const trimmed = content.trim();
  const fence = trimmed.match(/```json\s*([\s\S]*?)```/);
  if (fence) {
    const tasks = parseJsonTaskList(fence[1] ?? "");
    if (tasks.length > 0) {
      return `Plan draft · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
    }
  }
  return previewText(trimmed);
}

/** Copilot provider uses JSONL streaming when format is json or streaming. */
export type CopilotOutputFormat = "text" | "json" | "streaming";

export function normalizeCopilotOutputFormat(
  value: string | undefined,
): CopilotOutputFormat {
  const v = value?.trim().toLowerCase();
  if (v === "text" || v === "json" || v === "streaming") return v;
  return "streaming";
}

export function providerUsesJsonlLog(outputFormat: string | undefined): boolean {
  return outputFormat === "json" || outputFormat === "streaming";
}

/** Whether this call streams formatted lines (Copilot/Vibe/Olv JSONL), not mock/text-only. */
export function callOptsUseJsonlLog(opts: {
  provider: string;
  outputFormat?: string;
}): boolean {
  if (opts.provider === "mock") return false;
  if (
    opts.provider === "copilot" ||
    opts.provider === "vibe" ||
    opts.provider === "olv"
  ) {
    return providerUsesJsonlLog(opts.outputFormat);
  }
  return false;
}

/** Public repo: Copilot agent backend with JSONL output format. */
export function copilotAgentUsesJsonlLog(
  agentBackend: string | undefined,
  outputFormat: string | undefined,
): boolean {
  const b = (agentBackend ?? "copilot").trim().toLowerCase();
  if (b !== "copilot") return false;
  return providerUsesJsonlLog(outputFormat ?? "streaming");
}
