import {
    checkCommandHealth,
    runCliPromptProcess,
    summarizeArgsForMetaLog,
} from "./process-runner.js";
import type {
    CopilotCallOpts,
    ProviderHealthResult,
    ProviderRuntimeContext,
} from "./llm-types.js";
import {
    copilotStuckKeyFromLine,
    createCopilotStreamDedupState,
    extractCopilotJsonOutput,
    formatCopilotStreamLine,
} from "./copilot-stream.js";

export function runCopilotCall(
    opts: CopilotCallOpts,
    ctx: ProviderRuntimeContext,
): Promise<string> {
    const outputFormat = opts.outputFormat ?? "streaming";
    const useJsonl = outputFormat === "json" || outputFormat === "streaming";
    const isStreaming = outputFormat === "streaming";

    const args = [
        "-p",
        ctx.prompt,
        "--model",
        opts.model,
        "--autopilot",
        "--yolo",
        "--no-color",
    ];
    if (!useJsonl) {
        args.push("-s");
    }
    if (useJsonl) {
        args.push("--output-format", "json");
        if (isStreaming) {
            args.push("--stream", "on");
        }
    }
    if (opts.reasoningEffort) {
        args.push("--reasoning-effort", opts.reasoningEffort);
    }
    if (typeof opts.mcpConfig === "string" && opts.mcpConfig.trim() !== "") {
        args.push("--additional-mcp-config", `@${opts.mcpConfig.trim()}`);
    }

    const copilotTag = `[copilot:${opts.phase}]`;
    const logPrefix = `copilot:${opts.phase}`;
    const dedup = useJsonl ? createCopilotStreamDedupState() : undefined;

    const rawPromise = runCliPromptProcess({
        command: ctx.command,
        args,
        cwd: ctx.repoRoot,
        prompt: ctx.prompt,
        isRunning: ctx.isRunning,
        onLog: ctx.onLog,
        logPrefix,
        setCurrentProcess: ctx.setCurrentProcess,
        timeoutMs: ctx.timeoutMs,
        maxConsecutiveRepeats: ctx.maxConsecutiveRepeats,
        idleTimeoutMs: ctx.idleTimeoutMs,
        passPromptOnStdin: false,
        metaArgSummary: summarizeArgsForMetaLog(args, "-p"),
        formatLine: useJsonl
            ? (rawLine: string) =>
                formatCopilotStreamLine(rawLine, copilotTag, dedup)
            : undefined,
        stuckKeyFromLine: isStreaming ? copilotStuckKeyFromLine : undefined,
    });

    if (!useJsonl) {
        return rawPromise;
    }
    return rawPromise.then((raw) => extractCopilotJsonOutput(raw));
}

export function checkCopilotHealth(
    repoRoot: string,
): Promise<ProviderHealthResult> {
    return checkCommandHealth({
        command: "copilot",
        args: ["--version"],
        cwd: repoRoot,
    });
}
