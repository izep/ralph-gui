import {
  formatCopilotToolRequest,
  humanizeCombinedCopilotBody,
  humanizeReportIntentCall,
  looksLikeReportIntentCall,
  parseCopilotFunctionCall,
  summarizeCopilotToolResult,
  TOOL_PREVIEW_LEN,
} from "../../shared/copilotLogFormat";

export { humanizeCombinedCopilotBody };

const CONTENT_PREVIEW_LEN = 300;
const GENERIC_PREVIEW_LEN = 200;

export type HumanizeJsonResult =
  | { kind: "hidden" }
  | { kind: "display"; text: string; rawJson?: string };

export function looksLikeJson(body: string): boolean {
  const t = body.trim();
  return t.startsWith("{") || t.startsWith("[");
}

/** @deprecated Use `looksLikeReportIntentCall` */
export function looksLikeReportIntent(body: string): boolean {
  return looksLikeReportIntentCall(body);
}

/**
 * Humanize `report_intent({…})` function-call lines (OLV/MCP progress narration).
 */
export function humanizeReportIntentBody(body: string): HumanizeJsonResult | null {
  if (!looksLikeReportIntentCall(body)) return null;
  const text = humanizeReportIntentCall(body);
  if (!text) return null;
  const rawJson = body.trim().match(/(\{[\s\S]*\})\s*\)?\s*$/)?.[1];
  return { kind: "display", text, rawJson };
}

/**
 * Humanize a log line body: report_intent / copilot calls, then JSON envelopes/events.
 */
export function humanizeLogBody(
  tag: string,
  body: string,
): HumanizeJsonResult | null {
  const trimmed = body.trim();
  if (trimmed.startsWith("→ ")) {
    const summary = summarizeCopilotToolResult(trimmed.slice(2));
    return { kind: "display", text: `→ ${summary}` };
  }
  const fn = parseCopilotFunctionCall(trimmed);
  if (fn) {
    return {
      kind: "display",
      text: formatCopilotToolRequest(fn.name, fn.args),
    };
  }
  const intent = humanizeReportIntentBody(body);
  if (intent) return intent;
  return humanizeJsonLogBody(tag, body);
}

function preview(text: string, max = CONTENT_PREVIEW_LEN): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "..." : flat;
}

function vibeContentToText(content: unknown): string | null {
  if (content == null) return null;
  if (typeof content === "string") return content.length > 0 ? content : null;
  if (!Array.isArray(content)) return null;
  const chunks: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      chunks.push(part);
      continue;
    }
    if (part && typeof part === "object") {
      const o = part as Record<string, unknown>;
      if (typeof o.text === "string") chunks.push(o.text);
      else if (typeof o.content === "string") chunks.push(o.content);
    }
  }
  const joined = chunks.join("");
  return joined.length > 0 ? joined : null;
}

function summarizeToolResult(text: string): string {
  const cmdMatch = text.match(/^command:\s*(.+?)\s+stdout:/);
  if (cmdMatch) {
    const cmd = cmdMatch[1]!.trim();
    return cmd.length > TOOL_PREVIEW_LEN
      ? cmd.slice(0, TOOL_PREVIEW_LEN) + "..."
      : cmd;
  }
  return preview(text, TOOL_PREVIEW_LEN);
}

function formatVibeToolCall(tc: {
  function: { name: string; arguments: string };
}): string {
  const name = tc.function.name;
  try {
    const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
    return formatCopilotToolRequest(name, args);
  } catch {
    return `${name}(...)`;
  }
}

interface VibeStreamMsg {
  role?: string;
  content?: string | null | unknown[];
  tool_calls?: Array<{ function: { name: string; arguments: string } }> | null;
}

const COPILOT_SUPPRESSED = new Set([
  "session.mcp_server_status_changed",
  "session.mcp_servers_loaded",
  "session.skills_loaded",
  "session.tools_updated",
  "assistant.turn_start",
  "assistant.turn_end",
  "assistant.message_start",
  "assistant.message_delta",
]);

function humanizeVibeChatJson(trimmed: string, rawJson: string): HumanizeJsonResult | null {
  let msg: VibeStreamMsg;
  try {
    msg = JSON.parse(trimmed) as VibeStreamMsg;
  } catch {
    return null;
  }
  if (!msg.role && !msg.tool_calls) return null;

  const role = msg.role ?? "?";
  if (role === "system" || role === "user") {
    return { kind: "hidden" };
  }
  if (role === "assistant" && msg.tool_calls?.length) {
    const calls = msg.tool_calls.map(formatVibeToolCall);
    return { kind: "display", text: calls.join(" · "), rawJson };
  }
  if (role === "assistant") {
    const flat = vibeContentToText(msg.content);
    if (flat) {
      return { kind: "display", text: preview(flat), rawJson };
    }
  }
  if (role === "tool") {
    const flat = vibeContentToText(msg.content) ?? "";
    return {
      kind: "display",
      text: `→ ${summarizeToolResult(flat.replace(/\n/g, " ").trim())}`,
      rawJson,
    };
  }
  return { kind: "display", text: preview(trimmed, GENERIC_PREVIEW_LEN), rawJson };
}

function humanizeCopilotEventJson(trimmed: string, rawJson: string): HumanizeJsonResult | null {
  let ev: { type?: string; ephemeral?: boolean; data?: Record<string, unknown> };
  try {
    ev = JSON.parse(trimmed) as typeof ev;
  } catch {
    return null;
  }
  if (!ev.type) return null;

  const type = ev.type;
  if (COPILOT_SUPPRESSED.has(type)) return { kind: "hidden" };
  if (ev.ephemeral && type !== "tool.execution_complete") {
    return { kind: "hidden" };
  }

  const data = ev.data ?? {};

  if (type === "user.message") return { kind: "hidden" };

  if (type === "assistant.message") {
    const content = typeof data.content === "string" ? data.content : "";
    const tools = Array.isArray(data.toolRequests)
      ? data.toolRequests as Array<{
        name?: string;
        arguments?: Record<string, unknown>;
      }>
      : [];
    const parts: string[] = [];
    if (content.trim()) parts.push(preview(content));
    for (const tr of tools) {
      if (tr.name) {
        parts.push(formatCopilotToolRequest(tr.name, tr.arguments ?? {}));
      }
    }
    if (parts.length === 0) return { kind: "hidden" };
    return { kind: "display", text: parts.join(" · "), rawJson };
  }

  if (type === "tool.execution_start") {
    const name = String(data.toolName ?? data.tool_name ?? "tool");
    const args = (data.arguments ?? {}) as Record<string, unknown>;
    return {
      kind: "display",
      text: formatCopilotToolRequest(name, args),
      rawJson,
    };
  }

  if (type === "tool.execution_complete") {
    const result = data.result as
      | { content?: string; detailedContent?: string }
      | undefined;
    const text = result?.detailedContent ?? result?.content ?? "";
    return {
      kind: "display",
      text: `→ ${preview(String(text), TOOL_PREVIEW_LEN)}`,
      rawJson,
    };
  }

  if (type === "session.task_complete") {
    const summary = typeof data.summary === "string" ? data.summary : "";
    return {
      kind: "display",
      text: `✓ ${preview(summary, TOOL_PREVIEW_LEN)}`,
      rawJson,
    };
  }

  if (type === "result") return { kind: "hidden" };

  return { kind: "display", text: type, rawJson };
}

function humanizeOlvEnvelope(trimmed: string, rawJson: string): HumanizeJsonResult | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!("response" in obj) && !("model" in obj)) return null;

  const model = typeof obj.model === "string" ? obj.model : "";
  const done = obj.done === true;
  const response = obj.response;
  if (done && (response == null || response === "")) {
    const modelBit = model ? ` · model ${model}` : "";
    return { kind: "display", text: `Turn complete${modelBit}`, rawJson };
  }
  if (typeof response === "string" && response.trim()) {
    const modelBit = model ? `model ${model} · ` : "";
    return {
      kind: "display",
      text: `${modelBit}${preview(response)}`,
      rawJson,
    };
  }
  if (done) {
    return {
      kind: "display",
      text: model ? `Turn complete · model ${model}` : "Turn complete",
      rawJson,
    };
  }
  return null;
}

function humanizeGenericJson(trimmed: string, rawJson: string): HumanizeJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const text = trimmed.length > GENERIC_PREVIEW_LEN
      ? trimmed.slice(0, GENERIC_PREVIEW_LEN) + "..."
      : trimmed;
    return { kind: "display", text };
  }

  if (Array.isArray(parsed)) {
    const n = parsed.length;
    const sample = parsed.slice(0, 3).map((item, i) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const id = o.id != null ? `#${o.id}` : `[${i}]`;
        const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
        return title ? `${id} ${preview(title, 60)}` : String(id);
      }
      return preview(JSON.stringify(item), 60);
    });
    const more = n > 3 ? ` · +${n - 3} more` : "";
    return {
      kind: "display",
      text: `Array (${n}): ${sample.join(" · ")}${more}`,
      rawJson,
    };
  }

  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(o).slice(0, 6)) {
      if (v == null) parts.push(`${k}: —`);
      else if (typeof v === "string") {
        parts.push(`${k}: ${preview(v, 80)}`);
      } else if (typeof v === "number" || typeof v === "boolean") {
        parts.push(`${k}: ${String(v)}`);
      } else if (Array.isArray(v)) {
        parts.push(`${k}: [${v.length}]`);
      } else {
        parts.push(`${k}: {…}`);
      }
    }
    const extra = Object.keys(o).length > 6 ? ` · +${Object.keys(o).length - 6} keys` : "";
    return {
      kind: "display",
      text: parts.join(" · ") + extra,
      rawJson,
    };
  }

  return { kind: "display", text: preview(String(parsed)), rawJson };
}

function isCopilotEventShape(obj: Record<string, unknown>): boolean {
  return typeof obj.type === "string";
}

function isVibeChatShape(obj: Record<string, unknown>): boolean {
  return typeof obj.role === "string";
}

/**
 * Turn a JSON log body into a short human-readable summary for the log UI.
 */
export function humanizeJsonLogBody(
  tag: string,
  body: string,
): HumanizeJsonResult | null {
  const trimmed = body.trim();
  if (!looksLikeJson(trimmed)) return null;

  const rawJson = trimmed;

  let parsed: Record<string, unknown> | unknown[] | null = null;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown> | unknown[];
  } catch {
    const text = trimmed.length > GENERIC_PREVIEW_LEN
      ? trimmed.slice(0, GENERIC_PREVIEW_LEN) + "..."
      : trimmed;
    return { kind: "display", text };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;

    const olv = humanizeOlvEnvelope(trimmed, rawJson);
    if (olv) return olv;

    if (isCopilotEventShape(o) || tag.startsWith("[copilot")) {
      const cop = humanizeCopilotEventJson(trimmed, rawJson);
      if (cop) return cop;
    }

    if (isVibeChatShape(o) || tag.startsWith("[vibe")) {
      const vibe = humanizeVibeChatJson(trimmed, rawJson);
      if (vibe) return vibe;
    }
  }

  if (
    tag.startsWith("[vibe") ||
    tag.startsWith("[copilot") ||
    tag.includes(":stdout]")
  ) {
    const vibe = humanizeVibeChatJson(trimmed, rawJson);
    if (vibe) return vibe;
    const cop = humanizeCopilotEventJson(trimmed, rawJson);
    if (cop) return cop;
  }

  return humanizeGenericJson(trimmed, rawJson);
}
