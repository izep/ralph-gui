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
  LLMCaller,
  normalizeAgentBackend,
  normalizePromptForArgv,
  resolveClaudeCommand,
  resolveCopilotCommand,
  resolveCursorAgentCommand,
  resolveGeminiCommand,
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

describe("LLMCaller.call", () => {
  it("uses stdin for copilot and includes reasoning effort", async () => {
    process.env.COPILOT_BIN = await makeExecutable("copilot");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("hello prompt", "gpt-5-mini", tmpDir, {
      agentBackend: "copilot",
      reasoningEffort: "high",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.COPILOT_BIN);
    expect(args).toEqual([
      "--model", "gpt-5-mini",
      "--autopilot", "-s", "--yolo", "--no-color",
      "--reasoning-effort", "high",
    ]);
    expect(proc.stdin.write).toHaveBeenCalledWith("hello prompt");

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

  it("uses bypass permission mode for claude and does not write stdin", async () => {
    process.env.CLAUDE_BIN = await makeExecutable("claude");
    const caller = new LLMCaller(() => true);

    const resultPromise = caller.call("claude prompt", "claude-sonnet-4.6", tmpDir, {
      agentBackend: "claude",
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    const proc = spawnMock.mock.results[0].value as MockChildProcess;

    expect(command).toBe(process.env.CLAUDE_BIN);
    expect(args).toEqual([
      "-p", "claude prompt",
      "--model", "claude-sonnet-4.6",
      "--permission-mode", "bypassPermissions",
      "--output-format", "text",
    ]);
    expect(proc.stdin.write).not.toHaveBeenCalled();

    proc.stdout.emit("data", Buffer.from("ok"));
    proc.emit("close", 0);
    await expect(resultPromise).resolves.toBe("ok");
  });

  it("fails with a clear error for oversized argv prompts", async () => {
    process.env.CLAUDE_BIN = await makeExecutable("claude");
    const caller = new LLMCaller(() => true);

    const hugePrompt = "x".repeat(50_000);
    await expect(
      caller.call(hugePrompt, "claude-sonnet-4.6", tmpDir, {
        agentBackend: "claude",
      }),
    ).rejects.toThrow("Prompt too large to pass via argv for claude");

    expect(spawnMock).not.toHaveBeenCalled();
  });
});
