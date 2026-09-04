import { describe, expect, it } from "vitest";
import { formatElapsed, runCliPromptProcess } from "./process-runner.js";

describe("formatElapsed", () => {
  it("formats seconds and minutes", () => {
    expect(formatElapsed(1_000)).toBe("1s");
    expect(formatElapsed(60_000)).toBe("1m");
    expect(formatElapsed(76_000)).toBe("1m 16s");
  });
});

describe("runCliPromptProcess idle timeout", () => {
  it("kills a silent process after idleTimeoutMs", async () => {
    const logs: string[] = [];
    await expect(
      runCliPromptProcess({
        command: process.execPath,
        args: ["-e", "setInterval(() => {}, 1000)"],
        cwd: process.cwd(),
        prompt: "",
        isRunning: () => true,
        onLog: (line) => logs.push(line),
        logPrefix: "test",
        setCurrentProcess: () => { },
        passPromptOnStdin: false,
        idleTimeoutMs: 250,
        heartbeatIntervalMs: 50,
      }),
    ).rejects.toThrow(/no output for/);
    expect(logs.some((line) => line.includes("meta: kill idle"))).toBe(true);
  }, 8_000);

  it("does not idle-kill while the child keeps printing", async () => {
    const stdout = await runCliPromptProcess({
      command: process.execPath,
      args: [
        "-e",
        "const fs = require('fs'); let n = 0; const t = setInterval(() => { fs.writeSync(1, 'tick\\n'); if (++n >= 8) clearInterval(t); }, 40);",
      ],
      cwd: process.cwd(),
      prompt: "",
      isRunning: () => true,
      logPrefix: "test",
      setCurrentProcess: () => { },
      passPromptOnStdin: false,
      idleTimeoutMs: 200,
      heartbeatIntervalMs: 50,
    });
    expect(stdout).toContain("tick");
  }, 8_000);
});
