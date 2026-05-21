import { useState, useEffect, useRef, useCallback } from "react";
import type { TaskStatusData, LoopStatus, Settings, Readiness, ServerMessage } from "../types";

const EMPTY_TASKS: TaskStatusData = {
  tasks: [],
  currentTaskNum: 0,
  totalLLMCalls: 0,
  maxLLMCalls: 100,
  nextTask: {
    taskId: null,
    content: "",
    updatedAt: "",
  },
  feedback: {
    taskId: null,
    content: "",
    updatedAt: "",
  },
  lastUpdated: "",
};

// Fallback defaults — the server sends real settings on WebSocket init.
// Keep in sync with settings-manager.ts DEFAULT_SETTINGS.
const DEFAULT_SETTINGS: Settings = {
  maxLLMCalls: 100,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5.4-mini",
  qaModel: "gpt-5.4-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: false,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  fleetMode: false,
  useDocker: false,
  dockerComposeFile: "",
  dockerService: "ralph-agent",
  epicBaseBranch: "",
  dockerWorkBranch: "",
  dockerIsolateBranch: true,
  dockerPoolSize: 1,
  dockerParallelTasks: false,
  dockerPlanParallel: false,
  dockerInstalledBackends: [],
  dockerMountSocket: false,
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "idAsc",
  savedModelsByBackend: {},
};

const WS_RECONNECT_DELAY = 3000;

export function useRalph() {
  const [tasks, setTasks] = useState<TaskStatusData>(EMPTY_TASKS);
  const [loopStatus, setLoopStatus] = useState<LoopStatus>({ status: "idle", error: null });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [epic, setEpic] = useState("");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [log, setLog] = useState<string[]>([]);
  const [repoRoot, setRepoRoot] = useState("");
  const [readiness, setReadiness] = useState<Readiness>({
    repoConfigured: false,
    requirementsFound: false,
    requirementsFile: null,
    gitBranch: "",
    epicConfigured: false,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          switch (msg.type) {
            case "init":
              setTasks(msg.data.tasks);
              setLoopStatus(msg.data.loopStatus);
              setSettings(msg.data.settings);
              setEpic(msg.data.epic);
              setPrompts(msg.data.prompts);
              setLog(msg.data.log);
              setRepoRoot(msg.data.repoRoot);
              setReadiness(msg.data.readiness);
              break;
            case "tasks":
              setTasks(msg.data);
              break;
            case "log":
              setLog((prev) => [...prev.slice(-999), msg.data]);
              break;
            case "loopStatus":
              setLoopStatus(msg.data);
              break;
            case "settings":
              setSettings(msg.data);
              break;
            case "readiness":
              setReadiness(msg.data);
              break;
            case "epic":
              setEpic(msg.data);
              break;
          }
        } catch {
          // invalid message
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectRef.current = setTimeout(connect, WS_RECONNECT_DELAY);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  // --- Actions ---
  const startLoop = useCallback(async () => {
    const res = await fetch("/api/loop/start", { method: "POST" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setLoopStatus({
        status: "error",
        error: data.error ?? "Failed to start loop",
      });
    }
    return data;
  }, []);

  const saveSettingsAndStart = useCallback(
    async (settingsToRun: Settings) => {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToRun),
      });
      setSettings(settingsToRun);
      return startLoop();
    },
    [startLoop],
  );
  const stopLoop = useCallback(() => fetch("/api/loop/stop", { method: "POST" }), []);
  const restartLoop = useCallback(() => fetch("/api/loop/restart", { method: "POST" }), []);

  const saveSettings = useCallback(async (newSettings: Settings) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
  }, []);

  const saveEpic = useCallback(async (content: string) => {
    await fetch("/api/epic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }, []);

  const setRepo = useCallback(async (repoPath: string) => {
    const res = await fetch("/api/repo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: repoPath }),
    });
    return res.json();
  }, []);

  const savePrompt = useCallback(async (name: string, content: string) => {
    await fetch(`/api/prompts/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setPrompts((prev) => ({ ...prev, [name]: content }));
  }, []);

  const refreshBacklog = useCallback(async () => {
    const res = await fetch("/api/backlog/refresh", { method: "POST" });
    return res.json();
  }, []);

  const setEpicFile = useCallback(async (epicFile: string) => {
    const res = await fetch("/api/epic/set-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epicFile }),
    });
    return res.json() as Promise<{ ok: boolean; content?: string; notFound?: boolean; epicFile?: string }>;
  }, []);

  const createEpicFile = useCallback(async (epicFile: string) => {
    const res = await fetch("/api/epic/create-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epicFile }),
    });
    return res.json() as Promise<{ ok: boolean; content?: string }>;
  }, []);

  const validateDocker = useCallback(async () => {
    const res = await fetch("/api/docker/validate", { method: "POST" });
    return res.json() as Promise<{ ok: boolean; reason?: string; message?: string }>;
  }, []);

  const mergeEpicWork = useCallback(async () => {
    const res = await fetch("/api/git/merge-epic-work", { method: "POST" });
    return res.json() as Promise<{ ok: boolean; conflicts?: string[]; error?: string }>;
  }, []);

  return {
    tasks,
    loopStatus,
    settings,
    epic,
    prompts,
    log,
    repoRoot,
    readiness,
    connected,
    startLoop,
    saveSettingsAndStart,
    stopLoop,
    restartLoop,
    saveSettings,
    saveEpic,
    setRepo,
    savePrompt,
    refreshBacklog,
    setEpicFile,
    createEpicFile,
    validateDocker,
    mergeEpicWork,
  };
}
