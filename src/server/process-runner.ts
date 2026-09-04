import { type ChildProcess, spawn } from "child_process";

interface StreamState {
    remainder: string;
}

const HEARTBEAT_INTERVAL_MS = 60_000;

function emit(onLog: ((line: string) => void) | undefined, line: string): void {
    onLog?.(line);
}

export function formatElapsed(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function emitChunkLines(
    onLog: ((line: string) => void) | undefined,
    prefix: string,
    chunk: string,
    state: StreamState,
): void {
    const text = state.remainder + chunk;
    const parts = text.split(/\r?\n/);
    state.remainder = parts.pop() ?? "";
    for (const line of parts) {
        if (line.trim().length > 0) {
            emit(onLog, `${prefix} ${line}`);
        }
    }
}

function flushRemainder(
    onLog: ((line: string) => void) | undefined,
    prefix: string,
    state: StreamState,
): void {
    const line = state.remainder.trim();
    if (line.length > 0) {
        emit(onLog, `${prefix} ${line}`);
    }
    state.remainder = "";
}

function flushFormattedStdoutRemainder(
    onLog: ((line: string) => void) | undefined,
    formatLine: (rawLine: string) => string | null,
    state: StreamState,
): void {
    const line = state.remainder.trim();
    if (line.length > 0) {
        const formatted = formatLine(line);
        if (formatted !== null) emit(onLog, formatted);
    }
    state.remainder = "";
}

function normalizeLogLine(line: string): string {
  return line.trim().slice(0, 100);
}

/** Avoid dumping multi-KB `-p` prompts into `[olv:*] meta:` lines. */
export function summarizeArgsForMetaLog(args: string[], promptFlag = "-p"): string {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === promptFlag && i + 1 < args.length) {
      const b = Buffer.byteLength(args[i + 1]!, "utf8");
      out.push(promptFlag, `<${b}b>`);
      i++;
    } else {
      out.push(args[i]!);
    }
  }
  return out.join(" ");
}

function killGracefully(
    proc: ChildProcess,
    _onLog?: (line: string) => void,
    _logPrefix?: string,
): void {
    proc.kill("SIGTERM");
    const forceTimer = setTimeout(() => {
        try {
            proc.kill("SIGKILL");
        } catch {
            // already dead
        }
    }, 3000);
    proc.on("close", () => clearTimeout(forceTimer));
}

export async function runCliPromptProcess(params: {
  command: string;
  args: string[];
  cwd: string;
  prompt: string;
  isRunning: () => boolean;
  onLog?: (line: string) => void;
  logPrefix: string;
  setCurrentProcess: (proc: ChildProcess | null) => void;
  timeoutMs?: number;
  maxConsecutiveRepeats?: number;
  /**
   * Kill the child if it emits no stdout/stderr for this long.
   * Heartbeat lines do not count as child activity. `0` / unset disables.
   */
  idleTimeoutMs?: number;
  /** Override the 60s heartbeat (tests). */
  heartbeatIntervalMs?: number;
  /**
   * When `false`, stdin is not connected to the process (prompt is passed in `args`, e.g. `olv -p ...`).
   * @default true
   */
  passPromptOnStdin?: boolean;
  /**
   * When set, the first `meta: command ...` line uses this instead of `args.join(" ")` (e.g. to redact `-p`).
   */
  metaArgSummary?: string;
  /**
   * Prefix for each stderr line (include brackets for log tag parsing), e.g. `"[olv:plan]"`.
   * Default: `` `[${logPrefix}:stderr]` ``.
   */
  stderrLineTag?: string;
  /** Optional formatter applied to each stdout line before logging. */
  formatLine?: (rawLine: string) => string | null;
  /**
   * When set, stuck-loop detection compares consecutive keys from this hook
   * instead of raw stdout prefixes. Return null to skip a line (e.g. tool results).
   */
  stuckKeyFromLine?: (rawLine: string) => string | null;
}): Promise<string> {
  const {
    command,
    args,
    cwd,
    prompt,
    isRunning,
    onLog,
    logPrefix,
    setCurrentProcess,
    timeoutMs,
    maxConsecutiveRepeats = 0,
    idleTimeoutMs,
    heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS,
    passPromptOnStdin = true,
    metaArgSummary,
    stderrLineTag: stderrLineTagParam,
    formatLine,
    stuckKeyFromLine,
  } = params;

  const stderrLineTag = stderrLineTagParam ?? `[${logPrefix}:stderr]`;

    return new Promise((resolve, reject) => {
        if (!isRunning()) {
            reject(new Error("Loop was stopped"));
            return;
        }

        emit(
            onLog,
            `[${logPrefix}] meta: started ${command} ${
            metaArgSummary !== undefined
                ? metaArgSummary
                : args.join(" ")
            }`,
        );
        emit(
            onLog,
            `[${logPrefix}] meta: prompt ${
            Buffer.byteLength(prompt, "utf8")
            }b`,
        );

        const stdio: ["pipe" | "ignore", "pipe", "pipe"] = passPromptOnStdin
            ? ["pipe", "pipe", "pipe"]
            : ["ignore", "pipe", "pipe"];

        const proc = spawn(command, args, {
            cwd,
            stdio,
        });
        setCurrentProcess(proc);

        const startTime = Date.now();
        let lastActivityTime = startTime;

        let stdout = "";
        let stderr = "";
        let settled = false;
        const stdoutState: StreamState = { remainder: "" };
        const stderrState: StreamState = { remainder: "" };

        // --- Stuck-loop detection state ---
        let lastNormalizedLine = "";
        let consecutiveCount = 0;
        const repeatThreshold = maxConsecutiveRepeats > 0
            ? maxConsecutiveRepeats
            : 0;

        let wallTimer: ReturnType<typeof setTimeout> | null = null;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        function abort(reasonLog: string, error: Error): void {
            if (settled) return;
            settled = true;
            if (wallTimer) clearTimeout(wallTimer);
            if (heartbeat) clearInterval(heartbeat);
            emit(onLog, reasonLog);
            killGracefully(proc, onLog, logPrefix);
            setCurrentProcess(null);
            reject(error);
        }

        // --- Wall-clock timeout ---
        if (timeoutMs && timeoutMs > 0) {
            wallTimer = setTimeout(() => {
                const mins = Math.round(timeoutMs / 60_000);
                abort(
                    `[${logPrefix}] meta: kill timeout ${mins}m`,
                    new Error(
                        `Process killed: exceeded wall-clock timeout (${mins}m)`,
                    ),
                );
            }, timeoutMs);
        }

        const idleLimitMs = idleTimeoutMs && idleTimeoutMs > 0 ? idleTimeoutMs : 0;
        const tickMs = Math.max(50, heartbeatIntervalMs);

        heartbeat = setInterval(() => {
            const elapsed = formatElapsed(Date.now() - startTime);
            const silentMs = Date.now() - lastActivityTime;
            const silent = formatElapsed(silentMs);
            const idleBudget = idleLimitMs > 0
                ? `; kill after ${formatElapsed(idleLimitMs)} idle`
                : "";
            emit(
                onLog,
                `[${logPrefix}] meta: … ${elapsed} (idle ${silent}${idleBudget})`,
            );
            if (idleLimitMs > 0 && silentMs >= idleLimitMs) {
                abort(
                    `[${logPrefix}] meta: kill idle ${formatElapsed(idleLimitMs)}`,
                    new Error(
                        `Process killed: no output for ${formatElapsed(idleLimitMs)}`,
                    ),
                );
            }
        }, tickMs);

        function checkStuck(line: string): void {
            if (repeatThreshold <= 0) return;
            let normalized: string;
            if (stuckKeyFromLine) {
                const key = stuckKeyFromLine(line);
                if (key == null) return;
                normalized = key;
            } else {
                normalized = normalizeLogLine(line);
                if (normalized.length === 0) return;
            }
            if (normalized === lastNormalizedLine) {
                consecutiveCount++;
                if (consecutiveCount >= repeatThreshold) {
                    abort(
                        `[${logPrefix}] meta: kill stuck x${consecutiveCount}`,
                        new Error(
                            `Process killed: stuck loop detected (same output repeated ${consecutiveCount} times)`,
                        ),
                    );
                }
            } else {
                lastNormalizedLine = normalized;
                consecutiveCount = 1;
            }
        }

        proc.stdout?.on("data", (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            lastActivityTime = Date.now();
            // Emit lines and check for stuck loops
            const text = stdoutState.remainder + chunk;
            const parts = text.split(/\r?\n/);
            stdoutState.remainder = parts.pop() ?? "";
            for (const line of parts) {
                if (line.trim().length > 0) {
                    if (formatLine) {
                        const formatted = formatLine(line);
                        if (formatted !== null) emit(onLog, formatted);
                    } else {
                        emit(onLog, `[${logPrefix}:stdout] ${line}`);
                    }
                    checkStuck(line);
                }
            }
        });
        proc.stderr?.on("data", (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            lastActivityTime = Date.now();
            emitChunkLines(onLog, stderrLineTag, chunk, stderrState);
        });

        if (passPromptOnStdin && proc.stdin) {
            proc.stdin.write(prompt);
            proc.stdin.end();
        }

        proc.on("close", (code) => {
            if (heartbeat) clearInterval(heartbeat);
            if (wallTimer) clearTimeout(wallTimer);
            if (settled) return; // already rejected by timeout or stuck detection
            setCurrentProcess(null);
            if (formatLine) {
                flushFormattedStdoutRemainder(
                    onLog,
                    formatLine,
                    stdoutState,
                );
            } else {
                flushRemainder(onLog, `[${logPrefix}:stdout]`, stdoutState);
            }
            flushRemainder(onLog, stderrLineTag, stderrState);
            const elapsed = formatElapsed(Date.now() - startTime);
            if (code === 0) {
                emit(
                    onLog,
                    `[${logPrefix}] meta: ok (in ${elapsed})`,
                );
            } else {
                emit(
                    onLog,
                    `[${logPrefix}] meta: exit ${code ?? -1} (in ${elapsed})`,
                );
            }

            if (!isRunning()) {
                reject(new Error("Loop was stopped"));
            } else if (code !== 0) {
                reject(
                    new Error(
                        `${command} exited with code ${code}${
                            stderr ? ": " + stderr.slice(0, 300) : ""
                        }`,
                    ),
                );
            } else {
                resolve(stdout);
            }
        });

        proc.on("error", (err) => {
            if (heartbeat) clearInterval(heartbeat);
            if (wallTimer) clearTimeout(wallTimer);
            if (settled) return;
            setCurrentProcess(null);
            emit(onLog, `[${logPrefix}:error] ${err.message}`);
            reject(new Error(`Failed to run ${command}: ${err.message}`));
        });
    });
}

export async function checkCommandHealth(params: {
    command: string;
    args: string[];
    cwd: string;
    timeoutMs?: number;
}): Promise<{ ok: boolean; error?: string }> {
    const { command, args, cwd, timeoutMs = 4000 } = params;

    return new Promise((resolve) => {
        const proc = spawn(command, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";
        let done = false;

        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            proc.kill("SIGTERM");
            resolve({ ok: false, error: `${command} health check timed out` });
        }, timeoutMs);

        proc.stderr.on("data", (d: Buffer) => {
            stderr += d.toString();
        });

        proc.on("error", (err) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            const suffix = err.message.includes("ENOENT")
                ? " (command not found)"
                : "";
            resolve({ ok: false, error: `${command} unavailable${suffix}` });
        });

        proc.on("close", (code) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (code === 0) {
                resolve({ ok: true });
            } else {
                resolve({
                    ok: false,
                    error: `${command} health check failed (exit ${code})${
                        stderr ? `: ${stderr.slice(0, 200)}` : ""
                    }`,
                });
            }
        });
    });
}
