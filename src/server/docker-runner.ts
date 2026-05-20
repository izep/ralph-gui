// Docker host detection, compose file resolution, and spawn builder
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { Settings } from "./settings-manager.js";

export type DockerHostCheck =
  | { ok: true }
  | { ok: false; reason: "not_installed" | "not_running" | "compose_missing"; message: string };

interface RunResult {
  code: number;
  stderr: string;
  enoent: boolean;
}

function runCommand(cmd: string, args: string[], timeoutMs = 5000): Promise<RunResult> {
  return new Promise((resolve) => {
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
      proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (err) {
      resolve({ code: 1, stderr: String(err), enoent: true });
      return;
    }

    const timer = setTimeout(() => {
      proc.kill();
      settle({ code: 1, stderr: "timed out", enoent: false });
    }, timeoutMs);

    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      settle({ code: code ?? 1, stderr, enoent: false });
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      settle({ code: 1, stderr: err.message, enoent: err.code === "ENOENT" });
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

export function buildDockerSpawn(
  composeFile: string,
  service: string,
  command: string,
  commandArgs: string[],
): DockerSpawnSpec {
  return {
    cmd: "docker",
    args: [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "-w",
      "/workspace",
      service,
      command,
      ...commandArgs,
    ],
  };
}
