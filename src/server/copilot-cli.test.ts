import { describe, expect, it, vi } from "vitest";
import { runCopilotCall } from "./copilot-cli.js";
import type { CopilotCallOpts, ProviderRuntimeContext } from "./llm-types.js";

vi.mock("./process-runner.js", () => ({
    checkCommandHealth: vi.fn(),
    runCliPromptProcess: vi.fn(),
    summarizeArgsForMetaLog: vi.fn(() => "copilot … -p …"),
}));

vi.mock("./copilot-stream.js", () => ({
    extractCopilotJsonOutput: vi.fn((raw: string) => `extracted:${raw}`),
    formatCopilotStreamLine: vi.fn(),
    copilotStuckKeyFromLine: vi.fn(),
    createCopilotStreamDedupState: vi.fn(() => ({
        pendingSegments: new Set<string>(),
        lastIntent: null,
    })),
}));

describe("runCopilotCall argv", () => {
    async function capture(
        opts: CopilotCallOpts,
    ): Promise<{
        args: string[];
        logPrefix: string;
        passPromptOnStdin?: boolean;
        formatLine?: (line: string) => string | null;
        stuckKeyFromLine?: (line: string) => string | null;
        idleTimeoutMs?: number;
    }> {
        const { runCliPromptProcess } = await import("./process-runner.js");
        const runMock = vi.mocked(runCliPromptProcess);
        runMock.mockReset();
        runMock.mockResolvedValue("ok");
        const ctx: ProviderRuntimeContext = {
            prompt: "hi",
            repoRoot: "/tmp/repo",
            command: "copilot",
            isRunning: () => true,
            onLog: () => { },
            setCurrentProcess: () => { },
            timeoutMs: 5000,
            maxConsecutiveRepeats: 10,
            idleTimeoutMs: 600_000,
        };
        await runCopilotCall(opts, ctx);
        const call = runMock.mock.calls[0][0];
        return {
            args: call.args as string[],
            logPrefix: call.logPrefix,
            passPromptOnStdin: call.passPromptOnStdin,
            formatLine: call.formatLine,
            stuckKeyFromLine: call.stuckKeyFromLine,
            idleTimeoutMs: call.idleTimeoutMs as number | undefined,
        };
    }

    it("passes prompt via -p (non-interactive), not stdin", async () => {
        const { args, passPromptOnStdin } = await capture({
            phase: "dev",
            model: "m",
        });
        expect(args[0]).toBe("-p");
        expect(args[1]).toBe("hi");
        expect(passPromptOnStdin).toBe(false);
    });

    it("omits --additional-mcp-config when mcpConfig is unset", async () => {
        const { args } = await capture({
            phase: "dev",
            model: "m",
        });
        expect(args).not.toContain("--additional-mcp-config");
    });

    it("uses silent text mode when outputFormat is text", async () => {
        const { args, formatLine } = await capture({
            phase: "dev",
            model: "m",
            outputFormat: "text",
        });
        expect(args).toContain("-s");
        expect(args).not.toContain("--output-format");
        expect(formatLine).toBeUndefined();
    });

    it("uses JSONL streaming by default", async () => {
        const { args, formatLine, stuckKeyFromLine, idleTimeoutMs } = await capture({
            phase: "plan",
            model: "m",
        });
        expect(args).toContain("--output-format");
        expect(args).toContain("json");
        expect(args).toContain("--stream");
        expect(args).toContain("on");
        expect(formatLine).toBeTypeOf("function");
        expect(stuckKeyFromLine).toBeTypeOf("function");
        expect(idleTimeoutMs).toBe(600_000);
    });
});
