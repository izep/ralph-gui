// Docker host detection, compose file resolution, and spawn builder
import { existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { AgentBackendId } from "../shared/agent-models.js";
import type { Settings } from "./settings-manager.js";

const AGENT_CLI_CANDIDATES: Record<AgentBackendId, string[]> = {
  copilot: ["copilot"],
  "cursor-agent": ["cursor-agent", "cursor"],
  claude: ["claude"],
  gemini: ["gemini"],
};

const AGENT_CLI_INSTALL_HINT: Record<AgentBackendId, string> = {
  copilot: "npm install -g @github/copilot",
  "cursor-agent": "install Cursor CLI so `cursor-agent` is on PATH in the container",
  claude: "npm install -g @anthropic-ai/claude-code",
  gemini: "npm install -g @google/gemini-cli",
};

export type DockerHostCheck =
  | { ok: true }
  | { ok: false; reason: "not_installed" | "not_running" | "compose_missing"; message: string };

interface RunResult {
  code: number;
  stderr: string;
  stdout: string;
  enoent: boolean;
}

interface RunCommandOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

function runCommand(
  cmd: string,
  args: string[],
  timeoutMsOrOpts: number | RunCommandOpts = 5000,
): Promise<RunResult> {
  const opts =
    typeof timeoutMsOrOpts === "number" ? { timeoutMs: timeoutMsOrOpts } : timeoutMsOrOpts;
  const timeoutMs = opts.timeoutMs ?? 5000;

  return new Promise((resolve) => {
    let stderr = "";
    let stdout = "";
    let settled = false;

    const settle = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(cmd, args, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ code: 1, stderr: String(err), stdout: "", enoent: true });
      return;
    }

    const timer = setTimeout(() => {
      proc.kill();
      settle({ code: 1, stderr: "timed out", stdout, enoent: false });
    }, timeoutMs);

    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      settle({ code: code ?? 1, stderr, stdout, enoent: false });
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      settle({ code: 1, stderr: err.message, stdout, enoent: err.code === "ENOENT" });
    });
  });
}

export async function checkDockerHost(): Promise<DockerHostCheck> {
  // Step 1: Is Docker CLI installed?
  const versionResult = await runCommand("docker", ["version", "--format", "{{.Client.Version}}"]);
  if (
    versionResult.enoent ||
    versionResult.code === 127 ||
    versionResult.stderr.includes("not found") ||
    versionResult.stderr.includes("No such file")
  ) {
    return {
      ok: false,
      reason: "not_installed",
      message:
        "Docker is not installed. Install Docker Desktop or the Docker Engine package for your OS, then retry. See https://docs.docker.com/get-docker/",
    };
  }

  // Step 2: Is the daemon running?
  const infoResult = await runCommand("docker", ["info"], 5000);
  if (infoResult.code !== 0) {
    return {
      ok: false,
      reason: "not_running",
      message:
        "Docker is installed but the daemon is not running. Start Docker Desktop or the docker service (e.g. sudo systemctl start docker), then retry.",
    };
  }

  // Step 3: Is docker compose available?
  const composeResult = await runCommand("docker", ["compose", "version"]);
  if (composeResult.code !== 0) {
    return {
      ok: false,
      reason: "compose_missing",
      message:
        "Docker Compose is not available. Install the Docker Compose plugin (included with Docker Desktop) or run: sudo apt-get install docker-compose-plugin",
    };
  }

  return { ok: true };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Two levels up from src/server/ reaches the repo root where docker-compose.agents.yml lives
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

export function resolveComposeFile(
  settings: Pick<Settings, "dockerComposeFile">,
  repoRoot: string,
  packageRoot = PACKAGE_ROOT,
): string {
  const override = settings.dockerComposeFile?.trim();
  if (!override) {
    return path.join(packageRoot, "docker-compose.agents.yml");
  }
  if (path.isAbsolute(override)) {
    return override;
  }
  return path.join(repoRoot, override);
}

export interface DockerSpawnSpec {
  cmd: string;
  args: string[];
}

export interface DockerSpawnOpts {
  /** When set, appends `--index N` to `docker compose exec` (requires recent Compose plugin). */
  containerIndex?: number;
  /** Override the container working directory (defaults to /workspace). */
  worktreeCwd?: string;
}

export function buildDockerSpawn(
  composeFile: string,
  service: string,
  command: string,
  commandArgs: string[],
  opts?: DockerSpawnOpts,
): DockerSpawnSpec {
  const indexArgs = opts?.containerIndex != null ? ["--index", String(opts.containerIndex)] : [];
  const cwd = opts?.worktreeCwd ?? "/workspace";
  return {
    cmd: "docker",
    args: [
      "compose",
      "-f",
      composeFile,
      "exec",
      ...indexArgs,
      "-T",
      "-w",
      cwd,
      service,
      command,
      ...commandArgs,
    ],
  };
}

function dockerComposeEnv(repoRoot: string): NodeJS.ProcessEnv {
  return { ...process.env, RALPH_REPO_ROOT: repoRoot };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isComposeServiceRunning(
  composeFile: string,
  service: string,
  repoRoot: string,
): Promise<boolean> {
  const ps = await runCommand(
    "docker",
    ["compose", "-f", composeFile, "ps", "--status", "running", "--services", service],
    { cwd: repoRoot, env: dockerComposeEnv(repoRoot), timeoutMs: 15_000 },
  );
  return ps.code === 0 && ps.stdout.trim().length > 0;
}

async function fetchComposeServiceLogs(
  composeFile: string,
  service: string,
  repoRoot: string,
): Promise<string> {
  const logs = await runCommand(
    "docker",
    ["compose", "-f", composeFile, "logs", "--tail", "30", service],
    { cwd: repoRoot, env: dockerComposeEnv(repoRoot), timeoutMs: 15_000 },
  );
  return (logs.stdout || logs.stderr).trim().slice(0, 800);
}

async function waitForComposeServiceRunning(
  composeFile: string,
  service: string,
  repoRoot: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isComposeServiceRunning(composeFile, service, repoRoot)) {
      return true;
    }
    await delay(500);
  }
  return false;
}

/** Resolve an agent CLI executable path inside the running container (not on the host). */
export async function resolveAgentCliInDockerContainer(
  composeFile: string,
  service: string,
  repoRoot: string,
  backend: AgentBackendId,
): Promise<string> {
  const names = AGENT_CLI_CANDIDATES[backend];
  const probeScript = names.map((n) => `command -v ${n}`).join(" 2>/dev/null || ");
  const result = await runCommand(
    "docker",
    ["compose", "-f", composeFile, "exec", "-T", service, "sh", "-lc", `${probeScript} 2>/dev/null`],
    { cwd: repoRoot, env: dockerComposeEnv(repoRoot), timeoutMs: 30_000 },
  );

  const resolved = result.stdout.trim().split("\n").find((line) => line.trim())?.trim();
  if (result.code === 0 && resolved) {
    return resolved;
  }

  const detail = (result.stderr || result.stdout).trim().slice(0, 300);
  throw new Error(
    `Agent CLI "${names[0]}" is not installed in the Docker container (exit 127). ` +
    `Rebuild the image after adding: ${AGENT_CLI_INSTALL_HINT[backend]}. ` +
    `See docker/README.md.${detail ? ` Probe: ${detail}` : ""}`,
  );
}

/** Start the agent service so `docker compose exec` can run CLIs inside the container. */
export async function ensureDockerAgentRunning(
  composeFile: string,
  service: string,
  repoRoot: string,
  onLog?: (line: string) => void,
  agentBackend?: AgentBackendId,
  options?: {
    /** Additional backends to probe; missing ones are returned in missingClis. */
    installedBackends?: AgentBackendId[];
    /** When true, probe `docker info` inside the container (requires INSTALL_DOCKER_CLI + socket mount). */
    validateSocketMount?: boolean;
    /** Host socket path to verify exists (default: /var/run/docker.sock). */
    dockerSocketPath?: string;
  },
): Promise<{ ok: true; missingClis?: AgentBackendId[] } | { ok: false; message: string }> {
  const log = (line: string) => onLog?.(line);

  async function composeUp(forceRecreate: boolean): Promise<RunResult> {
    const args = ["compose", "-f", composeFile, "up", "-d", "--build"];
    if (forceRecreate) args.push("--force-recreate");
    args.push(service);
    return runCommand("docker", args, {
      cwd: repoRoot,
      env: dockerComposeEnv(repoRoot),
      timeoutMs: 300_000,
    });
  }

  log(`[docker] Ensuring service "${service}" is up (compose: ${composeFile})…`);
  let up = await composeUp(false);

  if (up.code !== 0) {
    const detail = (up.stderr || up.stdout).trim().slice(0, 500);
    return {
      ok: false,
      message: `Failed to start Docker service "${service}". ${detail || "Run docker compose up manually."}`,
    };
  }

  let running = await waitForComposeServiceRunning(composeFile, service, repoRoot, 15_000);
  if (!running) {
    log(`[docker] Service "${service}" exited after start; recreating container…`);
    up = await composeUp(true);
    if (up.code !== 0) {
      const detail = (up.stderr || up.stdout).trim().slice(0, 500);
      return {
        ok: false,
        message: `Failed to recreate Docker service "${service}". ${detail}`,
      };
    }
    running = await waitForComposeServiceRunning(composeFile, service, repoRoot, 30_000);
  }

  if (!running) {
    const tail = await fetchComposeServiceLogs(composeFile, service, repoRoot);
    return {
      ok: false,
      message:
        `Docker service "${service}" is not running after compose up. ` +
        `Recreate with: docker compose -f "${composeFile}" up -d --build --force-recreate ${service}` +
        (tail ? `\n\nRecent logs:\n${tail}` : ""),
    };
  }

  const probe = await runCommand(
    "docker",
    ["compose", "-f", composeFile, "exec", "-T", service, "node", "-v"],
    {
      cwd: repoRoot,
      env: dockerComposeEnv(repoRoot),
      timeoutMs: 60_000,
    },
  );

  if (probe.code !== 0) {
    const detail = (probe.stderr || probe.stdout).trim().slice(0, 500);
    const tail = await fetchComposeServiceLogs(composeFile, service, repoRoot);
    return {
      ok: false,
      message:
        `Docker service "${service}" is not reachable. ${detail || "Validate with Set Docker."}` +
        (tail ? `\n\nRecent logs:\n${tail}` : ""),
    };
  }

  const nodeVersion = probe.stdout.trim() || probe.stderr.trim();
  log(`[docker] Service "${service}" ready${nodeVersion ? ` (node ${nodeVersion})` : ""}.`);

  // Probe the active agent backend CLI.
  if (agentBackend) {
    try {
      const cliPath = await resolveAgentCliInDockerContainer(
        composeFile,
        service,
        repoRoot,
        agentBackend,
      );
      log(`[docker] Agent CLI (${agentBackend}): ${cliPath}`);
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  // Probe additional installed backends; collect any that are missing.
  const missingClis: AgentBackendId[] = [];
  if (options?.installedBackends?.length) {
    const backendsToProbe = options.installedBackends.filter((b) => b !== agentBackend);
    for (const backend of backendsToProbe) {
      try {
        await resolveAgentCliInDockerContainer(composeFile, service, repoRoot, backend);
        log(`[docker] Installed CLI (${backend}): found.`);
      } catch {
        log(`[docker] Installed CLI (${backend}): not found in image (missingClis).`);
        missingClis.push(backend);
      }
    }
  }

  // Validate Docker socket mount if requested.
  if (options?.validateSocketMount) {
    const socketPath = options.dockerSocketPath ?? "/var/run/docker.sock";
    if (!existsSync(socketPath)) {
      return {
        ok: false,
        message:
          `Docker socket not found at "${socketPath}". ` +
          `Set DOCKER_SOCKET in your .env to the correct socket path, or disable dockerMountSocket.`,
      };
    }
    const dockerInfoResult = await runCommand(
      "docker",
      ["compose", "-f", composeFile, "exec", "-T", service, "docker", "info"],
      { cwd: repoRoot, env: dockerComposeEnv(repoRoot), timeoutMs: 30_000 },
    );
    if (dockerInfoResult.code !== 0) {
      const detail = (dockerInfoResult.stderr || dockerInfoResult.stdout).trim().slice(0, 300);
      return {
        ok: false,
        message:
          `In-container "docker info" failed — socket mount may not be active or ` +
          `INSTALL_DOCKER_CLI=true was not used when building the image. ` +
          (detail ? `Detail: ${detail}. ` : "") +
          `Set DOCKER_SOCKET and RALPH_DOCKER_HOST in .env and rebuild with INSTALL_DOCKER_CLI=true.`,
      };
    }
    const dockerComposeVersionResult = await runCommand(
      "docker",
      ["compose", "-f", composeFile, "exec", "-T", service, "docker", "compose", "version"],
      { cwd: repoRoot, env: dockerComposeEnv(repoRoot), timeoutMs: 30_000 },
    );
    if (dockerComposeVersionResult.code !== 0) {
      return {
        ok: false,
        message:
          `In-container "docker compose version" failed. ` +
          `Rebuild the image with INSTALL_DOCKER_CLI=true (which installs docker-compose-plugin).`,
      };
    }
    log("[docker] Socket mount validated: docker info and docker compose version succeeded.");
  }

  return missingClis.length > 0 ? { ok: true, missingClis } : { ok: true };
}
