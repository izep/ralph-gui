import { EventEmitter } from "events";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import path from "path";
import { chmod, mkdtemp, rm, writeFile } from "fs/promises";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import {
  backendSupportsReasoningEffort,
  backendSupportsFleetMode,
  effectiveFleetMode,
  applyCopilotFleetPrefix,
  LLMCaller,
  normalizeAgentBackend,
  normalizePromptForArgv,
  resolveClaudeCommand,
  resolveCopilotCommand,
  resolveCursorAgentCommand,
  resolveGeminiCommand,
  resolveOpencodeCommand,
  shouldUseShellForCommand,
} from "./llm-caller.js";

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
}

let tmpDir: string;

async function makeExecutable(name: string): Promise<string> {
  const executable = path.join(tmpDir, process.platform === "win32" ? `${name}.cmd` : name);
  await writeFile(executable, process.platform === "win32" ? "@echo off" : "#!/bin/sh\nexit 0\n", "utf-8");
  if (process.platform !== "win32") {
    await chmod(executable, 0o755);
  }
  return executable;
}

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ralph-copilot-"));
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => new MockChildProcess());
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  delete process.env.COPILOT_BIN;
  delete process.env.CURSOR_AGENT_BIN;
  delete process.env.CLAUDE_BIN;
  delete process.env.GEMINI_BIN;
  delete process.env.RALPH_AGENT_BACKEND_OVERRIDE;
});

describe("resolveCopilotCommand", () => {
  it("prefers COPILOT_BIN when explicitly configured", async () => {
    const executable = path.join(tmpDir, process.platform === "win32" ? "copilot.cmd" : "copilot");
    await writeFile(executable, "echo test", "utf-8");
    if (process.platform !== "win32") {
      await chmod(executable, 0o755);
    }

    const resolved = await resolveCopilotCommand({ COPILOT_BIN: executable }, process.platform);
    expect(resolved).toBe(executable);
  });

  it("resolves copilot.cmd from PATH on Windows", async () => {
    const executable = path.join(tmpDir, "copilot.cmd");
    await writeFile(executable, "@echo off", "utf-8");

    const resolved = await resolveCopilotCommand(
      { PATH: tmpDir, PATHEXT: ".CMD;.BAT;.EXE" },
      "win32",
    );

    expect(resolved).toBe(executable);
  });

  it("resolves copilot from PATH on Unix-like platforms", async () => {
    const executable = path.join(tmpDir, "copilot");
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    await chmod(executable, 0o755);

    const resolved = await resolveCopilotCommand({ PATH: tmpDir }, "linux");
    expect(resolved).toBe(executable);
  });

  it("throws a helpful error when the CLI cannot be found", async () => {
    await expect(resolveCopilotCommand({ PATH: tmpDir }, "linux")).rejects.toThrow(
      "Copilot CLI not found in PATH",
    );
  });

  it("uses a shell for Windows batch and cmd launchers", () => {
    expect(shouldUseShellForCommand("C:/tools/copilot.cmd", "win32")).toBe(true);
    expect(shouldUseShellForCommand("C:/tools/copilot.bat", "win32")).toBe(true);
    expect(shouldUseShellForCommand("C:/tools/copilot.exe", "win32")).toBe(false);
    expect(shouldUseShellForCommand("/usr/local/bin/copilot", "linux")).toBe(false);
  });
});

describe("resolveCursorAgentCommand", () => {
  it("prefers CURSOR_AGENT_BIN when explicitly configured", async () => {
    const executable = path.join(tmpDir, process.platform === "win32" ? "cursor-agent.cmd" : "cursor-agent");
    await writeFile(executable, "echo test", "utf-8");
    if (process.platform !== "win32") {
      await chmod(executable, 0o755);
    }

    const resolved = await resolveCursorAgentCommand({ CURSOR_AGENT_BIN: executable }, process.platform);
    expect(resolved).toBe(executable);
  });

  it("resolves cursor-agent from PATH on Unix-like platforms", async () => {
    const executable = path.join(tmpDir, "cursor-agent");
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    await chmod(executable, 0o755);

    const resolved = await resolveCursorAgentCommand({ PATH: tmpDir }, "linux");
    expect(resolved).toBe(executable);
  });

  it("throws a helpful error when the CLI cannot be found", async () => {
    await expect(resolveCursorAgentCommand({ PATH: tmpDir }, "linux")).rejects.toThrow(
      "cursor-agent not found in PATH",
    );
  });
});

describe("resolveClaudeCommand", () => {
  it("prefers CLAUDE_BIN when explicitly configured", async () => {
    const executable = path.join(tmpDir, process.platform === "win32" ? "claude.cmd" : "claude");
    await writeFile(executable, "echo test", "utf-8");
    if (process.platform !== "win32") {
      await chmod(executable, 0o755);
    }

    const resolved = await resolveClaudeCommand({ CLAUDE_BIN: executable }, process.platform);
    expect(resolved).toBe(executable);
  });

  it("resolves claude from PATH on Unix-like platforms", async () => {
    const executable = path.join(tmpDir, "claude");
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    await chmod(executable, 0o755);

    const resolved = await resolveClaudeCommand({ PATH: tmpDir }, "linux");
    expect(resolved).toBe(executable);
  });

  it("throws a helpful error when the CLI cannot be found", async () => {
    await expect(resolveClaudeCommand({ PATH: tmpDir }, "linux")).rejects.toThrow(
      "Claude Code CLI not found in PATH",
    );
  });
});

describe("resolveGeminiCommand", () => {
  it("prefers GEMINI_BIN when explicitly configured", async () => {
    const executable = path.join(tmpDir, process.platform === "win32" ? "gemini.cmd" : "gemini");
    await writeFile(executable, "echo test", "utf-8");
    if (process.platform !== "win32") {
      await chmod(executable, 0o755);
    }

    const resolved = await resolveGeminiCommand({ GEMINI_BIN: executable }, process.platform);
    expect(resolved).toBe(executable);
  });

  it("resolves gemini from PATH on Unix-like platforms", async () => {
    const executable = path.join(tmpDir, "gemini");
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    await chmod(executable, 0o755);

    const resolved = await resolveGeminiCommand({ PATH: tmpDir }, "linux");
    expect(resolved).toBe(executable);
  });

  it("throws a helpful error when the CLI cannot be found", async () => {
    await expect(resolveGeminiCommand({ PATH: tmpDir }, "linux")).rejects.toThrow(
      "Gemini CLI not found in PATH",
    );
  });
});

describe("resolveOpencodeCommand", () => {
  it("prefers OPENCODE_BIN when explicitly configured", async () => {
    const executable = path.join(tmpDir, process.platform === "win32" ? "opencode.cmd" : "opencode");
    await writeFile(executable, "echo test", "utf-8");
    if (process.platform !== "win32") {
      await chmod(executable, 0o755);
    }

    const resolved = await resolveOpencodeCommand({ OPENCODE_BIN: executable }, process.platform);
    expect(resolved).toBe(executable);
  });

  it("resolves opencode from PATH on Unix-like platforms", async () => {
    const executable = path.join(tmpDir, "opencode");
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf-8");
    await chmod(executable, 0o755);

    const resolved = await resolveOpencodeCommand({ PATH: tmpDir }, "linux");
    expect(resolved).toBe(executable);
  });

  it("throws a helpful error when the CLI cannot be found", async () => {
    await expect(resolveOpencodeCommand({ PATH: tmpDir }, "linux")).rejects.toThrow(
      "OpenCode CLI not found in PATH",
    );
  });
});

describe("normalizeAgentBackend", () => {
  it("defaults unknown values to copilot", () => {
    expect(normalizeAgentBackend(undefined)).toBe("copilot");
    expect(normalizeAgentBackend("")).toBe("copilot");
    expect(normalizeAgentBackend("unknown")).toBe("copilot");
  });

  it("accepts configured backends case-insensitively", () => {
    expect(normalizeAgentBackend("cursor-agent")).toBe("cursor-agent");
    expect(normalizeAgentBackend("CURSOR-AGENT")).toBe("cursor-agent");
    expect(normalizeAgentBackend("claude")).toBe("claude");
    expect(normalizeAgentBackend("Claude")).toBe("claude");
    expect(normalizeAgentBackend("gemini")).toBe("gemini");
    expect(normalizeAgentBackend("Gemini")).toBe("gemini");
    expect(normalizeAgentBackend("opencode")).toBe("opencode");
    expect(normalizeAgentBackend("OpenCode")).toBe("opencode");
  });
});

describe("normalizePromptForArgv", () => {
  it("prefixes prompts that start with a dash so argv parsers treat them as text", () => {
    expect(normalizePromptForArgv("--not-a-flag")).toBe("\n--not-a-flag");
    expect(normalizePromptForArgv("-x")).toBe("\n-x");
  });

  it("leaves normal prompts unchanged", () => {
    expect(normalizePromptForArgv("hello")).toBe("hello");
  });
});

describe("backendSupportsReasoningEffort", () => {
  it("returns true for backends that accept reasoning effort flags", () => {
    expect(backendSupportsReasoningEffort("copilot")).toBe(true);
    expect(backendSupportsReasoningEffort("claude")).toBe(true);
  });

  it("returns false for backends without reasoning effort support", () => {
    expect(backendSupportsReasoningEffort("cursor-agent")).toBe(false);
    expect(backendSupportsReasoningEffort("gemini")).toBe(false);
    expect(backendSupportsReasoningEffort("opencode")).toBe(false);
  });
});

describe("LLMCaller.call", () => {
  it("uses -p and JSONL streaming for copilot with reasoning effort", async () => {
    process.env.COPILOT_BIN = await makeExecutable("copilot");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("hello prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      phase: "dev",
      reasoningEffort: "high",
      copilotOutputFormat: "streaming",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.COPILOT_BIN);
    expect(args).toEqual([
      "-p",
      "hello prompt",
      "--model",
      "gpt-5-mini",
      "--autopilot",
      "--yolo",
      "--no-color",
      "--output-format",
      "json",
      "--stream",
      "on",
      "--reasoning-effort",
      "high",
    ]);
    expect(proc.stdin.write).not.toHaveBeenCalled();

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("passes prompt in argv for cursor-agent and does not write stdin", async () => {
    process.env.CURSOR_AGENT_BIN = await makeExecutable("cursor-agent");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("cursor prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "cursor-agent",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.CURSOR_AGENT_BIN);
    expect(args).toEqual([
      "-p", "cursor prompt",
      "--model", "gpt-5-mini",
      "--yolo",
      "--output-format", "text",
    ]);
    expect(proc.stdin.write).not.toHaveBeenCalled();

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("honors RALPH_AGENT_BACKEND_OVERRIDE over requested backend", async () => {
    process.env.GEMINI_BIN = await makeExecutable("gemini");
    process.env.RALPH_AGENT_BACKEND_OVERRIDE = "gemini";
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("gemini prompt", "gemini-2.5-pro", tmpDir, {
      agentBackend: "copilot",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.GEMINI_BIN);
    expect(args).toEqual([
      "-p", "gemini prompt",
      "-m", "gemini-2.5-pro",
      "--yolo", "--output-format", "text",
    ]);

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("uses bypass permission mode and effort flag for claude", async () => {
    process.env.CLAUDE_BIN = await makeExecutable("claude");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("claude prompt", "claude-sonnet-4-6", tmpDir, {
      agentBackend: "claude",
      reasoningEffort: "high",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.CLAUDE_BIN);
    expect(args).toEqual([
      "-p", "claude prompt",
      "--model", "claude-sonnet-4-6",
      "--permission-mode", "bypassPermissions",
      "--output-format", "text",
      "--effort", "high",
    ]);
    expect(proc.stdin.write).not.toHaveBeenCalled();

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("ignores reasoning effort for cursor-agent", async () => {
    process.env.CURSOR_AGENT_BIN = await makeExecutable("cursor-agent");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("cursor prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "cursor-agent",
      reasoningEffort: "xhigh",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(args).not.toContain("--reasoning-effort");
    expect(args).not.toContain("--effort");

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("ignores reasoning effort for gemini", async () => {
    process.env.GEMINI_BIN = await makeExecutable("gemini");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("gemini prompt", "gemini-2.5-pro", tmpDir, {
      agentBackend: "gemini",
      reasoningEffort: "xhigh",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(args).not.toContain("--reasoning-effort");
    expect(args).not.toContain("--effort");

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("uses opencode run with stdin and dangerously-skip-permissions for opencode backend", async () => {
    process.env.OPENCODE_BIN = await makeExecutable("opencode");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("opencode prompt", "opencode/big-pickle", tmpDir, {
      agentBackend: "opencode",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.OPENCODE_BIN);
    expect(args).toEqual([
      "run",
      "-m", "opencode/big-pickle",
      "--dangerously-skip-permissions",
      "--format", "default",
    ]);
    expect(proc.stdin.write).toHaveBeenCalledWith("opencode prompt");

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("writes oversized opencode prompts to stdin instead of failing argv limits", async () => {
    process.env.OPENCODE_BIN = await makeExecutable("opencode");
    const caller = new LLMCaller(() => true);

    const hugePrompt = "x".repeat(50_000);
    const resultPromise = caller.call(hugePrompt, "opencode/big-pickle", tmpDir, {
      agentBackend: "opencode",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const proc = spawnMock.mock.results[0].value as MockChildProcess;
    expect(proc.stdin.write).toHaveBeenCalledWith(hugePrompt);

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("writes oversized cursor-agent prompts to stdin instead of failing argv limits", async () => {
    process.env.CURSOR_AGENT_BIN = await makeExecutable("cursor-agent");
    const caller = new LLMCaller(() => true);

    const hugePrompt = "x".repeat(50_000);
    const resultPromise = caller.call(hugePrompt, "gpt-5-mini", tmpDir, {
      agentBackend: "cursor-agent",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(args).toEqual([
      "--print",
      "--model", "gpt-5-mini",
      "--yolo",
      "--output-format", "text",
    ]);
    expect(proc.stdin.write).toHaveBeenCalledWith(hugePrompt);

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("writes oversized claude prompts to stdin instead of failing argv limits", async () => {
    process.env.CLAUDE_BIN = await makeExecutable("claude");
    const caller = new LLMCaller(() => true);

    const hugePrompt = "x".repeat(50_000);
    const resultPromise = caller.call(hugePrompt, "claude-sonnet-4-6", tmpDir, {
      agentBackend: "claude",
      reasoningEffort: "high",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(args).toEqual([
      "-p",
      "--model", "claude-sonnet-4-6",
      "--permission-mode", "bypassPermissions",
      "--output-format", "text",
      "--effort", "high",
    ]);
    expect(proc.stdin.write).toHaveBeenCalledWith(hugePrompt);

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("fails with a clear error for oversized gemini argv prompts", async () => {
    process.env.GEMINI_BIN = await makeExecutable("gemini");
    const caller = new LLMCaller(() => true);

    const hugePrompt = "x".repeat(50_000);
    await expect(
      caller.call(hugePrompt, "gemini-2.5-pro", tmpDir, {
        agentBackend: "gemini",
      }),
    ).rejects.toThrow("Prompt too large to pass via argv for gemini");

    expect(spawnMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fleet helpers
// ---------------------------------------------------------------------------

describe("backendSupportsFleetMode", () => {
  it("returns true for copilot", () => {
    expect(backendSupportsFleetMode("copilot")).toBe(true);
  });
  it("returns false for claude", () => {
    expect(backendSupportsFleetMode("claude")).toBe(false);
  });
  it("returns false for cursor-agent", () => {
    expect(backendSupportsFleetMode("cursor-agent")).toBe(false);
  });
  it("returns false for gemini", () => {
    expect(backendSupportsFleetMode("gemini")).toBe(false);
  });
});

describe("effectiveFleetMode", () => {
  it("returns true when fleetMode true and backend is copilot", () => {
    expect(effectiveFleetMode(true, "copilot")).toBe(true);
  });
  it("returns false when fleetMode false even if backend is copilot", () => {
    expect(effectiveFleetMode(false, "copilot")).toBe(false);
  });
  it("returns false when fleetMode true but backend is claude", () => {
    expect(effectiveFleetMode(true, "claude")).toBe(false);
  });
  it("returns false when fleetMode true but backend is cursor-agent", () => {
    expect(effectiveFleetMode(true, "cursor-agent")).toBe(false);
  });
});

describe("applyCopilotFleetPrefix", () => {
  it("returns prompt unchanged when disabled", () => {
    expect(applyCopilotFleetPrefix("my prompt", false)).toBe("my prompt");
  });
  it("prepends /fleet when enabled", () => {
    const result = applyCopilotFleetPrefix("my prompt", true);
    expect(result).toBe("/fleet\n\nmy prompt");
  });
  it("is idempotent when prompt already starts with /fleet", () => {
    const prompt = "/fleet\n\nmy prompt";
    expect(applyCopilotFleetPrefix(prompt, true)).toBe(prompt);
  });
  it("handles leading whitespace before /fleet", () => {
    const prompt = "  /fleet\n\nmy prompt";
    expect(applyCopilotFleetPrefix(prompt, true)).toBe(prompt);
  });
});

describe("LLMCaller.call with fleetMode", () => {
  it("applies /fleet prefix to the prompt when copilot + fleetMode true", async () => {
    process.env.COPILOT_BIN = await makeExecutable("gh");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("do the work", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      fleetMode: true,
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const proc = spawnMock.mock.results[0].value as MockChildProcess;
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    // Non-Docker copilot calls pass the prompt via argv (-p), not stdin.
    const promptArg = args[args.indexOf("-p") + 1];
    expect(promptArg).toMatch(/^\/fleet/);

    proc.stdout.emit("data", Buffer.from("done"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("done");
  });

  it("does NOT apply /fleet prefix when claude + fleetMode true (defense in depth)", async () => {
    process.env.CLAUDE_BIN = await makeExecutable("claude");
    const caller = new LLMCaller(() => true);

    const shortPrompt = "short prompt";
    const resultPromise = caller.call(shortPrompt, "claude-sonnet-4-6", tmpDir, {
      agentBackend: "claude",
      fleetMode: true,
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    // claude uses argv, not stdin — verify /fleet is not in argv
    expect(args.join(" ")).not.toContain("/fleet");

    const proc = spawnMock.mock.results[0].value as MockChildProcess;
    proc.stdout.emit("data", Buffer.from("result"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("result");
  });
});

describe("LLMCaller.call with useDocker", () => {
  it("uses docker compose exec with CLI resolved inside the container", async () => {
    let execCalls = 0;
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockChildProcess();
      queueMicrotask(() => {
        if (args.some((a) => typeof a === "string" && a.includes("command -v"))) {
          proc.stdout.emit("data", Buffer.from("/usr/local/bin/copilot\n"));
          proc.emit("close", 0);
          return;
        }
        execCalls++;
        proc.stdout.emit("data", Buffer.from("done"));
        proc.emit("close", 0);
      });
      return proc;
    });

    const caller = new LLMCaller(() => true);
    const resultPromise = caller.call("prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      useDocker: true,
      dockerService: "ralph-agent",
      dockerComposeFile: "",
    });

    await vi.waitFor(() => expect(execCalls).toBeGreaterThan(0));
    const agentCall = spawnMock.mock.calls.find((c) => {
      const args = c[1] as string[];
      return args.includes("ralph-agent") && args.includes("/usr/local/bin/copilot");
    });
    expect(agentCall).toBeDefined();
    await expect(resultPromise).resolves.toBe("done");
  });

  it("streams stdout lines to onProgress while running", async () => {
    process.env.CURSOR_AGENT_BIN = await makeExecutable("cursor-agent");
    const caller = new LLMCaller(() => true);
    const progress: string[] = [];

    const resultPromise = caller.call("prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "cursor-agent",
      onProgress: (line) => progress.push(line),
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const proc = spawnMock.mock.results[0].value as MockChildProcess;
    proc.stdout.emit("data", Buffer.from("line one\nline two\n"));
    proc.stdout.emit("data", Buffer.from("done"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toContain("line one");

    expect(progress).toEqual(["line one", "line two", "done"]);
  });

  it("uses host CLI argv when useDocker is false", async () => {
    process.env.COPILOT_BIN = await makeExecutable("gh");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      useDocker: false,
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [cmd] = spawnMock.mock.calls[0] as [string, string[]];
    // Should be the resolved 'gh' path, not 'docker'
    expect(cmd).not.toBe("docker");

    const proc = spawnMock.mock.results[0].value as MockChildProcess;
    proc.stdout.emit("data", Buffer.from("done"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("done");
  });
});

// ---------------------------------------------------------------------------
// LLMCaller — parallel Docker calls (Epic 004)
// ---------------------------------------------------------------------------

describe("LLMCaller parallel Docker calls", () => {
  function makeDockerMock(responsesByExecCount: Array<{ stdout: string; code: number }>) {
    let execCount = 0;
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockChildProcess();
      queueMicrotask(() => {
        if (args.some((a) => typeof a === "string" && a.includes("command -v"))) {
          proc.stdout.emit("data", Buffer.from("/usr/local/bin/copilot\n"));
          proc.emit("close", 0);
          return;
        }
        const r = responsesByExecCount[execCount] ?? { stdout: "ok", code: 0 };
        execCount++;
        proc.stdout.emit("data", Buffer.from(r.stdout));
        proc.emit("close", r.code);
      });
      return proc;
    });
  }

  it("includes --index in spawn args when dockerContainerIndex is set", async () => {
    makeDockerMock([{ stdout: "ok", code: 0 }]);
    const caller = new LLMCaller(() => true);

    const p = caller.call("prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      useDocker: true,
      dockerComposeFile: "",
      dockerService: "ralph-agent",
      dockerContainerIndex: 2,
    });

    await expect(p).resolves.toBe("ok");

    const execCall = spawnMock.mock.calls.find(
      (c) => (c[1] as string[]).includes("exec") && (c[1] as string[]).includes("/usr/local/bin/copilot"),
    ) as [string, string[]];
    expect(execCall).toBeTruthy();
    expect(execCall[1]).toContain("--index");
    const idxPos = execCall[1].indexOf("--index");
    expect(execCall[1][idxPos + 1]).toBe("2");
  });

  it("uses worktreeCwd in -w arg when dockerWorktreeCwd is set", async () => {
    makeDockerMock([{ stdout: "ok", code: 0 }]);
    const caller = new LLMCaller(() => true);

    const p = caller.call("prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      useDocker: true,
      dockerComposeFile: "",
      dockerService: "ralph-agent",
      dockerContainerIndex: 0,
      dockerWorktreeCwd: "/workspace/.ralph/worktrees/slot-0",
    });

    await expect(p).resolves.toBe("ok");

    const execCall = spawnMock.mock.calls.find(
      (c) => (c[1] as string[]).includes("exec") && (c[1] as string[]).includes("/usr/local/bin/copilot"),
    ) as [string, string[]];
    expect(execCall).toBeTruthy();
    const wIdx = execCall[1].indexOf("-w");
    expect(wIdx).toBeGreaterThan(-1);
    expect(execCall[1][wIdx + 1]).toBe("/workspace/.ralph/worktrees/slot-0");
  });

  it("stop() kills all active processes and rejects their promises", async () => {
    const isRunning = { value: true };
    const caller = new LLMCaller(() => isRunning.value);

    // Proc that never closes on its own (simulates long-running container exec)
    const holdingProc = new MockChildProcess();
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const proc = new MockChildProcess();
      queueMicrotask(() => {
        if (args.some((a) => typeof a === "string" && a.includes("command -v"))) {
          proc.stdout.emit("data", Buffer.from("/usr/local/bin/copilot\n"));
          proc.emit("close", 0);
          return;
        }
        // Don't close — simulate a hanging process; return a stable ref
        Object.assign(proc, holdingProc);
      });
      return proc;
    });

    const p0 = caller.call("p0", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      useDocker: true,
      dockerComposeFile: "",
      dockerService: "ralph-agent",
      dockerContainerIndex: 0,
    });

    // Wait for CLI probe to complete (first exec spawned)
    await vi.waitFor(() =>
      expect(
        spawnMock.mock.calls.some((c) =>
          (c[1] as string[]).some((a) => typeof a === "string" && a.includes("command -v")),
        ),
      ).toBe(true),
    );

    // Mark stopped and call stop()
    isRunning.value = false;
    caller.stop();

    // Simulate the process finally closing after being killed
    const execProc = spawnMock.mock.results[spawnMock.mock.results.length - 1].value as MockChildProcess;
    execProc.emit("close", 0);

    await expect(p0).rejects.toThrow("Loop was stopped");
  });
});

