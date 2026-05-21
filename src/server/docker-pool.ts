// Container pool for parallel Docker agent execution
import { spawn } from "child_process";

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runPoolCommand(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = 30_000,
): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      resolve({ code: 1, stdout: "", stderr: String(err) });
      return;
    }

    const timer = setTimeout(() => {
      proc.kill();
      settle({ code: 1, stdout, stderr: "timed out" });
    }, timeoutMs);

    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => settle({ code: code ?? 1, stdout, stderr }));
    proc.on("error", (err) => settle({ code: 1, stdout, stderr: err.message }));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scale the compose service to `poolSize` replicas and wait until they are running.
 * Throws if the service does not reach the expected count within 60 seconds.
 */
export async function ensureDockerPool(
  composeFile: string,
  service: string,
  poolSize: number,
  repoRoot: string,
): Promise<void> {
  const env = { ...process.env, RALPH_REPO_ROOT: repoRoot };

  const up = await runPoolCommand(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "up",
      "-d",
      "--build",
      "--scale",
      `${service}=${poolSize}`,
    ],
    env,
    300_000,
  );
  if (up.code !== 0) {
    const detail = (up.stderr || up.stdout).trim().slice(0, 500);
    throw new Error(
      `Failed to scale Docker service "${service}" to ${poolSize}. ${detail || "Run docker compose up manually."}`,
    );
  }

  // Wait until poolSize containers are running (poll for up to 60s).
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ids = await listPoolContainers(composeFile, service, repoRoot);
    if (ids.length >= poolSize) return;
    await delay(1000);
  }
  const ids = await listPoolContainers(composeFile, service, repoRoot);
  if (ids.length < poolSize) {
    throw new Error(
      `Docker service "${service}" only has ${ids.length}/${poolSize} running containers after 60s.`,
    );
  }
}

/**
 * Return ordered container IDs for the scaled service replicas.
 * The order matches the `--index` values used by `docker compose exec`.
 */
export async function listPoolContainers(
  composeFile: string,
  service: string,
  repoRoot: string,
): Promise<string[]> {
  const env = { ...process.env, RALPH_REPO_ROOT: repoRoot };
  const result = await runPoolCommand(
    "docker",
    ["compose", "-f", composeFile, "ps", "-q", service],
    env,
  );
  if (result.code !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * In-memory pool allocator: manages slot indices 0..poolSize-1.
 * Callers acquire a slot before spawning into a container, then release it when done.
 */
export class DockerPool {
  private available: number[];
  private waitQueue: Array<(slot: number) => void> = [];

  constructor(private readonly poolSize: number) {
    this.available = Array.from({ length: poolSize }, (_, i) => i);
  }

  /** Re-initialize the pool (e.g. if poolSize changed). */
  init(): void {
    this.available = Array.from({ length: this.poolSize }, (_, i) => i);
    this.waitQueue = [];
  }

  /** Acquire a pool slot. Resolves immediately if one is free, otherwise waits. */
  acquire(): Promise<number> {
    if (this.available.length > 0) {
      return Promise.resolve(this.available.shift()!);
    }
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /** Return a slot to the pool. */
  release(slot: number): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next(slot);
    } else {
      this.available.push(slot);
    }
  }

  /** Drain the pool (e.g. on loop stop). Resolves all pending waiters with -1 (sentinel). */
  stopAll(): void {
    const queued = this.waitQueue.splice(0);
    for (const resolve of queued) {
      resolve(-1);
    }
    this.available = [];
  }
}
