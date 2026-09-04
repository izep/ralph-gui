import {
    formatCopilotToolRequest,
    previewAssistantContent,
    previewText,
    summarizeCopilotToolResult,
    TOOL_PREVIEW_LEN,
} from "../shared/copilotLogFormat.js";

/** Copilot CLI JSONL event (not OpenAI chat `role` / `content`). */
interface CopilotEvent {
    type?: string;
    ephemeral?: boolean;
    data?: Record<string, unknown>;
}

const SUPPRESSED_TYPES = new Set([
    "session.mcp_server_status_changed",
    "session.mcp_servers_loaded",
    "session.skills_loaded",
    "session.tools_updated",
    "assistant.turn_start",
    "assistant.turn_end",
    "assistant.message_start",
    "assistant.message_delta",
]);

/** Suppress duplicate tool lines after a combined `assistant.message`. */
export type CopilotStreamDedupState = {
    pendingSegments: Set<string>;
    lastIntent: string | null;
};

export function createCopilotStreamDedupState(): CopilotStreamDedupState {
    return { pendingSegments: new Set(), lastIntent: null };
}

/**
 * Formats one Copilot `--output-format json` line for the Ralph log UI.
 * When `dedup` is set, drops `tool.execution_start` lines already shown on the
 * preceding combined `assistant.message`, and echoes of `report_intent` results.
 */
export function formatCopilotStreamLine(
    raw: string,
    tag: string,
    dedup?: CopilotStreamDedupState,
): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let ev: CopilotEvent;
    try {
        ev = JSON.parse(trimmed) as CopilotEvent;
    } catch {
        return `${tag} ${previewText(trimmed, 200)}`;
    }

    const type = ev.type ?? "";
    if (!type || SUPPRESSED_TYPES.has(type)) return null;
    if (ev.ephemeral && type !== "tool.execution_complete") return null;

    const data = ev.data ?? {};

    if (type === "user.message") return null;

    if (type === "assistant.message") {
        const content = typeof data.content === "string" ? data.content : "";
        const tools = Array.isArray(data.toolRequests)
            ? data.toolRequests as Array<{
                name?: string;
                arguments?: Record<string, unknown>;
            }>
            : [];
        const parts: string[] = [];
        if (content.trim()) {
            parts.push(previewAssistantContent(content));
        }
        const pending = new Set<string>();
        for (const tr of tools) {
            if (tr.name) {
                const formatted = formatCopilotToolRequest(
                    tr.name,
                    tr.arguments ?? {},
                );
                parts.push(formatted);
                pending.add(formatted);
                if (tr.name === "report_intent") {
                    const intent = typeof tr.arguments?.intent === "string"
                        ? tr.arguments.intent.trim()
                        : "";
                    if (dedup) dedup.lastIntent = intent || null;
                }
            }
        }
        if (dedup) {
            dedup.pendingSegments = pending;
        }
        if (parts.length === 0) return null;
        return `${tag} ${parts.join(" · ")}`;
    }

    if (type === "tool.execution_start") {
        const name = String(data.toolName ?? data.tool_name ?? "tool");
        const args = (data.arguments ?? {}) as Record<string, unknown>;
        const formatted = formatCopilotToolRequest(name, args);
        if (dedup?.pendingSegments.has(formatted)) return null;
        if (name === "report_intent") {
            const intent = typeof args.intent === "string"
                ? args.intent.trim()
                : "";
            if (dedup) dedup.lastIntent = intent || null;
        }
        return `${tag} ${formatted}`;
    }

    if (type === "tool.execution_complete") {
        const result = data.result as
            | { content?: string; detailedContent?: string }
            | undefined;
        const text = result?.detailedContent ?? result?.content ?? "";
        const summary = summarizeCopilotToolResult(String(text));
        if (
            dedup?.lastIntent &&
            (summary === dedup.lastIntent ||
                summary === `Intent · ${dedup.lastIntent}`)
        ) {
            return null;
        }
        return `${tag} → ${summary}`;
    }

    if (type === "session.task_complete") {
        const summary = typeof data.summary === "string" ? data.summary : "";
        return `${tag} ✓ ${previewText(summary, TOOL_PREVIEW_LEN)}`;
    }

    if (type === "result") return null;

    return `${tag} ${type}`;
}

function copilotEventText(ev: CopilotEvent): string | null {
    const data = ev.data ?? {};
    const type = ev.type ?? "";

    if (type === "assistant.message" || type === "assistant.message_delta") {
        const content = data.content;
        return typeof content === "string" && content.trim() ? content : null;
    }
    if (type === "session.task_complete") {
        const summary = data.summary;
        return typeof summary === "string" && summary.trim() ? summary : null;
    }
    if (type === "result") {
        if (typeof data.content === "string" && data.content.trim()) return data.content;
        if (typeof data.text === "string" && data.text.trim()) return data.text;
        if (typeof data.result === "string" && data.result.trim()) return data.result;
        if (typeof data.summary === "string" && data.summary.trim()) return data.summary;
    }
    return null;
}

/** Collect assistant text from Copilot JSONL for loop status-tag parsing. */
export function extractCopilotJsonOutput(raw: string): string {
    const parts: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const ev = JSON.parse(trimmed) as CopilotEvent;
            const text = copilotEventText(ev);
            if (text) parts.push(text);
        } catch {
            parts.push(trimmed);
        }
    }
    return parts.join("\n");
}

/** Stable key for stuck-loop detection on Copilot tool starts. */
export function copilotStuckKeyFromLine(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
        const ev = JSON.parse(trimmed) as CopilotEvent;
        if (ev.type === "tool.execution_start") {
            const data = ev.data ?? {};
            const name = String(data.toolName ?? "");
            const args = JSON.stringify(data.arguments ?? {});
            return `${name}:${args}`;
        }
        if (ev.type === "assistant.message") {
            const tools = ev.data?.toolRequests;
            if (Array.isArray(tools) && tools.length > 0) {
                return JSON.stringify(tools.map((t) => ({
                    name: (t as { name?: string }).name,
                    args: (t as { arguments?: unknown }).arguments,
                })));
            }
        }
    } catch {
        return null;
    }
    return null;
}
