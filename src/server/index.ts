import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { RalphLoop } from "./ralph-loop.js";
import { DEFAULT_SETTINGS } from "./templates.js";
import { getArg, hasFlag, applyCliSettingsOverrides } from "./cli-args.js";
import { headlessShutdownForLoopStatus } from "./headless-shutdown.js";
import { RalphRunTracker } from "./run-tracker.js";
import {
  checkDockerHost,
  ensureDockerAgentRunning,
  resolveComposeFile,
  resolveDockerSocketPath,
} from "./docker-runner.js";
import { GitManager } from "./git-manager.js";

// --- CLI args ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRepo = getArg("--repo");
const cliStart = hasFlag("--start");
const exitWhenComplete = hasFlag("--exit-when-complete");
const parsedPort = Number(getArg("--port") ?? 3001);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3001;

// --- State ---
let loop: RalphLoop | null = null;
let loopStatus: "idle" | "running" | "error" | "stopped" = "idle";
let loopError: string | null = null;
let logBuffer: string[] = [];
const MAX_LOG_LINES = 1000;
let requestShutdown: ((reason: string, exitCode?: number) => Promise<void>) | null = null;
let runTracker: RalphRunTracker | null = null;

function addLog(line: string) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer = logBuffer.slice(-MAX_LOG_LINES);
  if (cliStart) {
    console.log(line);
  }
  runTracker?.record(line);
  broadcast(JSON.stringify({ type: "log", data: line }));
}

function makeCallbacks(isActive: () => boolean, getActiveLoop: () => RalphLoop | null) {
  return {
    onLog: (line: string) => {
      if (!isActive()) return;
      addLog(line);
    },
    onLoopStatus: (status: string, error: string | null) => {
      if (!isActive()) return;
      loopStatus = status as typeof loopStatus;
      loopError = error;
      runTracker?.setLoopStatus(loopStatus);
      broadcast(JSON.stringify({ type: "loopStatus", data: { status: loopStatus, error: loopError } }));

      if (exitWhenComplete) {
        const decision = headlessShutdownForLoopStatus(
          loopStatus,
          getActiveLoop()?.didCompleteEpic ?? false,
        );
        if (decision) {
          addLog(
            `[ralph] Loop ended (${decision.reason}), exiting server (--exit-when-complete).`,
          );
          setTimeout(() => {
            void requestShutdown?.(decision.reason, decision.exitCode);
          }, 100);
        }
      }
    },
    onTasksUpdated: (data: object) => {
      if (!isActive()) return;
      broadcast(JSON.stringify({ type: "tasks", data }));
    },
  };
}

async function buildReadiness() {
  const repoConfigured = loop !== null;
  let requirementsFile: string | null = null;
  let gitBranch = "";
  let epicConfigured = false;
  let dockerHostOk: boolean | undefined;
  let dockerHostError: string | undefined;
  if (loop) {
    requirementsFile = await loop.checkRequirements();
    gitBranch = await loop.getCurrentBranch();
    epicConfigured = await loop.isEpicConfigured();
    const settings = await loop.readSettings();
    if (settings.useDocker) {
      const dockerCheck = await checkDockerHost();
      dockerHostOk = dockerCheck.ok;
      if (!dockerCheck.ok) {
        dockerHostError = dockerCheck.message;
      }
    }
  }
  return {
    repoConfigured,
    requirementsFound: requirementsFile !== null,
    requirementsFile,
    gitBranch,
    epicConfigured,
    ...(dockerHostOk !== undefined ? { dockerHostOk, dockerHostError } : {}),
  };
}

function requireRepoConfigured(res: express.Response): RalphLoop | null {
  if (!loop) {
    res.status(400).json({ ok: false, error: "Set repo root first" });
    return null;
  }
  return loop;
}

async function setRepo(repoPath: string): Promise<{ ok: boolean; error?: string }> {
  const previousLoop = loop;
  if (previousLoop) {
    loop = null;
    await previousLoop.shutdown();
  }

  try {
    let nextLoop: RalphLoop | null = null;
    nextLoop = new RalphLoop(repoPath, makeCallbacks(() => loop === nextLoop, () => nextLoop));
    await nextLoop.bootstrap();
    loop = nextLoop;
    runTracker = new RalphRunTracker(loop.ralphDir);
    logBuffer = [];
    loopStatus = "idle";
    loopError = null;

    const readiness = await buildReadiness();
    addLog(`[ralph] Repository set to ${loop.repoRoot}`);
    if (readiness.requirementsFile) {
      addLog(`[ralph] Found requirements: ${readiness.requirementsFile}`);
    } else {
      addLog("[ralph] Warning: no requirements.md found in repo root");
    }

    // Broadcast full state refresh to all clients
    broadcastFullState();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function broadcastFullState() {
  const data = await getInitData();
  broadcast(JSON.stringify({ type: "init", data }));
}

async function getInitData() {
  const tasks = loop
    ? await loop.readStatusFile()
    : {
      tasks: [],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 500,
      nextTask: { taskId: null, content: "", updatedAt: "" },
      feedback: { taskId: null, content: "", updatedAt: "" },
      lastUpdated: "",
    };
  const settings = loop ? await loop.readSettings() : DEFAULT_SETTINGS;
  let epic = "";
  try {
    if (loop) {
      epic = await loop.readEpic();
    }
  } catch {
    /* */
  }
  const prompts: Record<string, string> = {};
  if (loop) {
    for (const name of ["plan-prompt.md", "dev-prompt.md", "qa-prompt.md"]) {
      try { prompts[name] = await loop.readRalphFile(name); } catch { /* */ }
    }
  }
  const readiness = await buildReadiness();
  return {
    tasks,
    loopStatus: { status: loopStatus, error: loopError },
    settings,
    epic,
    prompts,
    log: logBuffer,
    repoRoot: loop?.repoRoot ?? "",
    readiness,
  };
}

// --- Express ---
const app = express();
app.use(express.json({ limit: "1mb" }));

const distPath = path.resolve(__dirname, "../../dist");

// Models reference (before SPA static so it is never swallowed by index.html fallback)
import { AGENT_MODEL_CATALOG, PREFERRED_MODELS_BY_BACKEND, type AgentBackendId } from "../shared/agent-models.js";
import { buildModelsReferenceHtml } from "./models-reference.js";

app.get("/api/agent-models", (req, res) => {
  const backend = (req.query.backend as string) as AgentBackendId;
  const catalog = AGENT_MODEL_CATALOG[backend];
  if (!catalog) return res.status(400).json({ ok: false, error: "Unknown backend" });
  res.json({ ok: true, backend, models: catalog, preferred: PREFERRED_MODELS_BY_BACKEND[backend] });
});

app.get("/models-reference", (req, res) => {
  const backend = ((req.query.backend as string) ?? "copilot") as AgentBackendId;
  const html = buildModelsReferenceHtml(backend);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.use(express.static(distPath));

// Tasks
app.get("/api/tasks", async (_req, res) => {
  res.json(
    loop
      ? await loop.readStatusFile()
      : {
        tasks: [],
        currentTaskNum: 0,
        totalLLMCalls: 0,
        maxLLMCalls: 500,
        nextTask: { taskId: null, content: "", updatedAt: "" },
        feedback: { taskId: null, content: "", updatedAt: "" },
        lastUpdated: "",
      }
  );
});

// Loop control
app.get("/api/loop/status", (_req, res) => {
  res.json({ status: loopStatus, error: loopError });
});
app.post("/api/loop/start", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const result = await activeLoop.start();
  if (!result.ok) {
    loopStatus = "idle";
    loopError = result.error ?? "Failed to start loop";
    addLog(`[system] Loop start failed: ${loopError}`);
    broadcast(JSON.stringify({ type: "loopStatus", data: { status: loopStatus, error: loopError } }));
  }
  res.json(result);
});
app.post("/api/loop/stop", (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  res.json(activeLoop.stop());
});
app.post("/api/loop/restart", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  res.json(await activeLoop.restart());
});

// Repo
app.get("/api/repo", async (_req, res) => {
  res.json({ path: loop?.repoRoot ?? null, readiness: await buildReadiness() });
});
app.put("/api/repo", async (req, res) => {
  const { path: repoPath } = req.body;
  if (!repoPath || typeof repoPath !== "string") {
    return res.status(400).json({ ok: false, error: "path is required" });
  }
  res.json(await setRepo(repoPath));
});

// Readiness
app.get("/api/readiness", async (_req, res) => {
  res.json(await buildReadiness());
});

// Settings
app.get("/api/settings", async (_req, res) => {
  res.json(loop ? await loop.readSettings() : DEFAULT_SETTINGS);
});
app.put("/api/settings", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  try {
    await activeLoop.writeSettings(req.body);
    broadcast(JSON.stringify({ type: "settings", data: req.body }));
    // Re-broadcast readiness (requirementsFile may have changed)
    const readiness = await buildReadiness();
    broadcast(JSON.stringify({ type: "readiness", data: readiness }));
    // Re-broadcast epic (epicFile may have changed)
    try {
      const epic = await activeLoop.readEpic();
      broadcast(JSON.stringify({ type: "epic", data: epic }));
    } catch { /* */ }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Epic
app.get("/api/epic", async (_req, res) => {
  if (!loop) return res.json({ content: "" });
  try {
    const content = await loop.readEpic();
    res.json({ content });
  } catch {
    res.json({ content: "" });
  }
});
app.put("/api/epic", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  try {
    await activeLoop.writeEpic(req.body.content);
    res.json({ ok: true });
    const readiness = await buildReadiness();
    broadcast(JSON.stringify({ type: "readiness", data: readiness }));
    // Auto-refresh backlog when epic changes (fire-and-forget, only when loop is not running)
    if (!activeLoop.isRunning) {
      activeLoop.refreshBacklog().catch(() => { });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Prompts
const PROMPT_FILES = ["plan-prompt.md", "dev-prompt.md", "qa-prompt.md"];
app.get("/api/prompts/:name", async (req, res) => {
  if (!loop) return res.json({ content: "" });
  const name = req.params.name;
  if (!PROMPT_FILES.includes(name)) return res.status(400).json({ ok: false, error: "Invalid prompt name" });
  try {
    res.json({ content: await loop.readRalphFile(name) });
  } catch {
    res.json({ content: "" });
  }
});
app.put("/api/prompts/:name", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const name = req.params.name;
  if (!PROMPT_FILES.includes(name)) return res.status(400).json({ ok: false, error: "Invalid prompt name" });
  try {
    await activeLoop.writeRalphFile(name, req.body.content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Log
app.get("/api/log", (_req, res) => res.json({ lines: logBuffer }));

// Backlog refresh
app.post("/api/backlog/refresh", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  if (activeLoop.isRunning) return res.json({ ok: false, error: "Cannot refresh backlog while loop is running" });
  res.json(await activeLoop.refreshBacklog());
});

// Resolve blocker
app.post("/api/tasks/:id/resolve-blocker", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) return res.status(400).json({ ok: false, error: "Invalid task id" });
  if (activeLoop.isRunning) return res.status(409).json({ ok: false, error: "Cannot resolve blocker while loop is running" });
  try {
    await activeLoop.resolveBlocker(taskId);
    res.json({ ok: true });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("not found") || msg.includes("not blocked")) {
      res.status(404).json({ ok: false, error: msg });
    } else {
      res.status(500).json({ ok: false, error: msg });
    }
  }
});

// Epic file set and create
app.post("/api/epic/set-file", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const { epicFile } = req.body;
  if (!epicFile || typeof epicFile !== "string") {
    return res.status(400).json({ ok: false, error: "epicFile is required" });
  }
  const trimmed = epicFile.trim();
  // Reject path traversal outside repo root
  const resolved = path.resolve(activeLoop.repoRoot, trimmed);
  if (!resolved.startsWith(activeLoop.repoRoot + path.sep) && resolved !== activeLoop.repoRoot) {
    return res.status(400).json({ ok: false, error: "Path traversal not allowed" });
  }
  try {
    const { readFile: rf } = await import("fs/promises");
    const content = await rf(resolved, "utf-8");
    const settings = await activeLoop.readSettings();
    await activeLoop.writeSettings({ ...settings, epicFile: trimmed });
    broadcast(JSON.stringify({ type: "epic", data: content }));
    const readiness = await buildReadiness();
    broadcast(JSON.stringify({ type: "readiness", data: readiness }));
    res.json({ ok: true, content, created: false });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return res.json({ ok: false, notFound: true, epicFile: trimmed });
    }
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/epic/create-file", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const { epicFile } = req.body;
  if (!epicFile || typeof epicFile !== "string") {
    return res.status(400).json({ ok: false, error: "epicFile is required" });
  }
  const trimmed = epicFile.trim();
  const resolved = path.resolve(activeLoop.repoRoot, trimmed);
  if (!resolved.startsWith(activeLoop.repoRoot + path.sep) && resolved !== activeLoop.repoRoot) {
    return res.status(400).json({ ok: false, error: "Path traversal not allowed" });
  }
  try {
    const { mkdir: mkdirFs, writeFile: wf } = await import("fs/promises");
    await mkdirFs(path.dirname(resolved), { recursive: true });
    const { DEFAULT_EPIC } = await import("./templates.js");
    await wf(resolved, DEFAULT_EPIC, "utf-8");
    const settings = await activeLoop.readSettings();
    await activeLoop.writeSettings({ ...settings, epicFile: trimmed });
    broadcast(JSON.stringify({ type: "epic", data: DEFAULT_EPIC }));
    const readiness = await buildReadiness();
    broadcast(JSON.stringify({ type: "readiness", data: readiness }));
    res.json({ ok: true, content: DEFAULT_EPIC, created: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Docker validate and status
app.post("/api/docker/validate", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  const hostCheck = await checkDockerHost();
  if (!hostCheck.ok) {
    return res.json(hostCheck);
  }
  try {
    const settings = await activeLoop.readSettings();
    const composeFile = resolveComposeFile(
      { dockerComposeFile: settings.dockerComposeFile },
      activeLoop.repoRoot,
    );
    // Verify compose file resolves (exists on disk)
    const { access: accessFs, constants: fsConstants } = await import("fs");
    await new Promise<void>((resolve, reject) => {
      accessFs(composeFile, fsConstants.R_OK, (err) => {
        if (err) reject(new Error(`Compose file not found: ${composeFile}`));
        else resolve();
      });
    });

    const service = settings.dockerService || "ralph-agent";
    const ensure = await ensureDockerAgentRunning(
      composeFile,
      service,
      activeLoop.repoRoot,
      (line) => addLog(line),
      settings.agentBackend,
      {
        installedBackends: settings.dockerInstalledBackends,
        validateSocketMount: settings.dockerMountSocket,
        dockerSocketPath: resolveDockerSocketPath(),
      },
    );
    if (!ensure.ok) {
      return res.json({ ok: false, reason: "compose_missing", message: ensure.message });
    }

    res.json({ ok: true, composeFile, service, missingClis: ensure.missingClis ?? [] });
  } catch (err) {
    res.json({ ok: false, reason: "compose_missing", message: String(err) });
  }
});

app.get("/api/docker/status", async (_req, res) => {
  const hostCheck = await checkDockerHost();
  res.json(hostCheck);
});

// Git branch status and merge-back
app.get("/api/git/branch-status", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  try {
    const settings = await activeLoop.readSettings();
    const gitManager = new GitManager(activeLoop.repoRoot);
    const { epicBaseBranch, dockerWorkBranch } = settings;
    let ahead = 0;
    let behind = 0;
    if (epicBaseBranch && dockerWorkBranch) {
      const ab = await gitManager.getBranchAheadBehind(epicBaseBranch, dockerWorkBranch);
      ahead = ab.ahead;
      behind = ab.behind;
    }
    res.json({ epicBaseBranch, dockerWorkBranch, ahead, behind });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/git/merge-epic-work", async (_req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  if (activeLoop.isRunning) return res.status(409).json({ ok: false, error: "Cannot merge while loop is running" });
  try {
    const settings = await activeLoop.readSettings();
    const { epicBaseBranch, dockerWorkBranch } = settings;
    if (!epicBaseBranch || !dockerWorkBranch) {
      return res.status(400).json({ ok: false, error: "epicBaseBranch and dockerWorkBranch must be set in settings" });
    }
    const gitManager = new GitManager(activeLoop.repoRoot);
    // Checkout base branch
    await gitManager.createOrCheckoutBranch(epicBaseBranch, epicBaseBranch);
    const mergeResult = await gitManager.mergeWorkBranch(dockerWorkBranch);
    if (!mergeResult.ok) {
      return res.json({ ok: false, conflicts: mergeResult.conflicts ?? [] });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --- WebSocket ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(message: string) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

wss.on("connection", async (ws) => {
  ws.send(JSON.stringify({ type: "init", data: await getInitData() }));
});

function closeWebSocketServer(): Promise<void> {
  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }

  return new Promise((resolve) => {
    wss.close(() => resolve());
  });
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function shutdownServer(reason: string, exitCode = 0): Promise<void> {
  if (shutdownServer.inProgress) {
    return;
  }

  shutdownServer.inProgress = true;
  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref?.();

  try {
    console.log(`Shutting down Ralph Control Panel (${reason})...`);
    const activeLoop = loop;
    loop = null;
    if (activeLoop) {
      await activeLoop.shutdown();
    }

    const results = await Promise.allSettled([closeWebSocketServer(), closeHttpServer()]);

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      for (const r of failed) {
        console.error("Shutdown step failed:", (r as PromiseRejectedResult).reason);
      }
      process.exit(1);
    }
    process.exit(exitCode);
  } catch (err) {
    console.error(`Shutdown failed: ${String(err)}`);
    process.exit(1);
  } finally {
    clearTimeout(forceExitTimer);
  }
}

shutdownServer.inProgress = false;
requestShutdown = shutdownServer;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdownServer(signal);
  });
}

// SPA fallback (never serve the Kanban app for API or models-reference)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/models-reference") {
    next();
    return;
  }
  res.sendFile(path.join(distPath, "index.html"));
});

// --- Start ---
server.listen(PORT, async () => {
  console.log(`Ralph Control Panel: http://localhost:${PORT}`);

  if (cliStart && !cliRepo) {
    console.error("Cannot use --start without --repo.");
    process.exit(1);
  }

  if (cliRepo) {
    await setRepo(cliRepo);
    await applyCliSettingsOverrides(loop!);

    if (cliStart) {
      console.log("Starting Ralph loop...");
      const result = await loop!.start();
      if (!result.ok && result.error) {
        console.error(`Failed to start loop: ${result.error}`);
        process.exit(1);
      }
    }
  } else {
    console.log("No --repo provided. Configure the repository from the Control Panel.");
  }
});
