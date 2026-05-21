import { describe, expect, it } from "vitest";
import {
    createCopilotStreamDedupState,
    extractCopilotJsonOutput,
    formatCopilotStreamLine,
} from "./copilot-stream.js";

const TAG = "[copilot:dev]";

describe("formatCopilotStreamLine", () => {
    it("suppresses ephemeral session noise", () => {
        const line = JSON.stringify({
            type: "session.mcp_servers_loaded",
            ephemeral: true,
            data: {},
        });
        expect(formatCopilotStreamLine(line, TAG)).toBeNull();
    });

    it("formats assistant.message with content", () => {
        const line = JSON.stringify({
            type: "assistant.message",
            data: { content: "Hello world", toolRequests: [] },
        });
        expect(formatCopilotStreamLine(line, TAG)).toBe(
            `${TAG} Hello world`,
        );
    });

    it("formats tool execution", () => {
        const start = JSON.stringify({
            type: "tool.execution_start",
            data: {
                toolName: "bash",
                arguments: { command: "npm test" },
            },
        });
        expect(formatCopilotStreamLine(start, TAG)).toBe(`${TAG} $ npm test`);
    });

    it("formats view tool by short path", () => {
        const start = JSON.stringify({
            type: "tool.execution_start",
            data: {
                toolName: "view",
                arguments: { path: "/x/output/src/App.tsx" },
            },
        });
        expect(formatCopilotStreamLine(start, TAG)).toBe(`${TAG} read src/App.tsx`);
    });

    it("dedupes tool.execution_start after assistant.message", () => {
        const dedup = createCopilotStreamDedupState();
        const msg = JSON.stringify({
            type: "assistant.message",
            data: {
                content: "",
                toolRequests: [{
                    name: "view",
                    arguments: { path: "/p/out" },
                }],
            },
        });
        const start = JSON.stringify({
            type: "tool.execution_start",
            data: {
                toolName: "view",
                arguments: { path: "/p/out" },
            },
        });
        expect(formatCopilotStreamLine(msg, TAG, dedup)).toContain("read p/out");
        expect(formatCopilotStreamLine(start, TAG, dedup)).toBeNull();
    });

    it("summarizes diff tool results", () => {
        const done = JSON.stringify({
            type: "tool.execution_complete",
            data: {
                result: {
                    content:
                        "diff --git a/x/output/App.tsx b/x/output/App.tsx",
                },
            },
        });
        const line = formatCopilotStreamLine(done, TAG);
        expect(line).toMatch(/→ read/);
        expect(line).not.toContain("diff --git");
    });
});

describe("extractCopilotJsonOutput", () => {
    it("collects assistant.message content", () => {
        const lines = [
            JSON.stringify({
                type: "assistant.message",
                data: { content: "<status>complete</status>" },
            }),
            JSON.stringify({ type: "session.task_complete", data: {} }),
        ].join("\n");
        expect(extractCopilotJsonOutput(lines)).toContain(
            "<status>complete</status>",
        );
    });
});
