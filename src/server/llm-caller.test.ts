import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { chmod, mkdtemp, rm, writeFile } from "fs/promises";
import {
  normalizeAgentBackend,
  normalizePromptForArgv,
  resolveClaudeCommand,
  resolveCopilotCommand,
  resolveCursorAgentCommand,
  resolveGeminiCommand,
  shouldUseShellForCommand,
} from "./llm-caller.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ralph-copilot-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
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