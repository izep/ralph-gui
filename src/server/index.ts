import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { RalphLoop } from "./ralph-loop.js";
import { DEFAULT_SETTINGS } from "./templates.js";
import type { Settings } from "./settings-manager.js";

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

function getBooleanArg(name: string): boolean | undefined {
  const value = getArg(name);
  if (value === undefined) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}

function getNumberArg(name: string): number | undefined {
  const value = getArg(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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
let requestShutdown: ((reason: string) => Promise<void>) | null = null;

async function applyCliSettingsOverrides(): Promise<void> {
  if (!loop) return;
  const current = await loop.readSettings();

  const agentBackendArg = getArg("--agent-backend");
  const agentBackendOverride =
    agentBackendArg &&
    ["copilot", "cursor-agent", "claude"].includes(agentBackendArg.toLowerCase())
      ? agentBackendArg.toLowerCase()
      : undefined;

  const next: Settings = {
    ...current,
    ...(getArg("--plan-model") ? { planModel: getArg("--plan-model")! } : {}),
    ...(getArg("--dev-model") ? { devModel: getArg("--dev-model")! } : {}),
    ...(getArg("--qa-model") ? { qaModel: getArg("--qa-model")! } : {}),
    ...(getArg("--dev-reasoning-effort") ? { devReasoningEffort: getArg("--dev-reasoning-effort")! } : {}),
    ...(getArg("--qa-reasoning-effort") ? { qaReasoningEffort: getArg("--qa-reasoning-effort")! } : {}),
    ...(getNumberArg("--max-llm-calls") !== undefined ? { maxLLMCalls: getNumberArg("--max-llm-calls")! } : {}),
    ...(getNumberArg("--plan-frequency") !== undefined ? { planFrequency: getNumberArg("--plan-frequency")! } : {}),
    ...(getNumberArg("--min-backlog-size") !== undefined ? { minBacklogSize: getNumberArg("--min-backlog-size")! } : {}),
    ...(getBooleanArg("--auto-commit") !== undefined ? { autoCommit: getBooleanArg("--auto-commit")! } : {}),
    ...(agentBackendOverride ? { agentBackend: agentBackendOverride } : {}),
  };

  await loop.writeSettings(next);
}

function addLog(line: string) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer = logBuffer.slice(-MAX_LOG_LINES);
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
      broadcast(JSON.stringify({ type: "loopStatus", data: { status: loopStatus, error: loopError } }));

      if (exitWhenComplete && loopStatus === "idle" && getActiveLoop()?.didCompleteEpic) {
        addLog("[system] Epic complete, exiting server (--exit-when-complete).");
        setTimeout(() => {
          void requestShutdown?.("epic-complete");
        }, 100);
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
  if (loop) {
    requirementsFile = await loop.checkRequirements();
    gitBranch = await loop.getCurrentBranch();
    epicConfigured = await loop.isEpicConfigured();
  }
  return {
    repoConfigured,
    requirementsFound: requirementsFile !== null,
    requirementsFile,
    gitBranch,
    epicConfigured,
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
    logBuffer = [];
    loopStatus = "idle";
    loopError = null;

    const readiness = await buildReadiness();
    addLog(`[system] Repository set to ${loop.repoRoot}`);
    if (readiness.requirementsFile) {
      addLog(`[system] Found requirements: ${readiness.requirementsFile}`);
    } else {
      addLog("[system] Warning: no requirements.md found in repo root");
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
        maxLLMCalls: 100,
        nextTask: { taskId: null, content: "", updatedAt: "" },
        feedback: { taskId: null, content: "", updatedAt: "" },
        lastUpdated: "",
      };
  const settings = loop ? await loop.readSettings() : DEFAULT_SETTINGS;
  let epic = "";
  try {
    if (loop) {
      epic = await loop.readRalphFile("epic.md");
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
          maxLLMCalls: 100,
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
  res.json(await activeLoop.start());
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
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Epic
app.get("/api/epic", async (_req, res) => {
  if (!loop) return res.json({ content: "" });
  try {
    const content = await loop.readRalphFile("epic.md");
    res.json({ content });
  } catch {
    res.json({ content: "" });
  }
});
app.put("/api/epic", async (req, res) => {
  const activeLoop = requireRepoConfigured(res);
  if (!activeLoop) return;
  try {
    await activeLoop.writeRalphFile("epic.md", req.body.content);
    res.json({ ok: true });
    const readiness = await buildReadiness();
    broadcast(JSON.stringify({ type: "readiness", data: readiness }));
    // Auto-refresh backlog when epic changes (fire-and-forget, only when loop is not running)
    if (!activeLoop.isRunning) {
      activeLoop.refreshBacklog().catch(() => {});
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

async function shutdownServer(reason: string): Promise<void> {
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
    process.exit(0);
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

// SPA fallback
app.get("*", (_req, res) => {
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
    await applyCliSettingsOverrides();

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
