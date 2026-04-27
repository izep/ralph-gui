import { useState, useRef, useCallback } from "react";
import { useRalph } from "./hooks/useRalph";
import { KanbanColumn } from "./components/KanbanColumn";
import { ControlPanel } from "./components/ControlPanel";
import { LogViewer } from "./components/LogViewer";
import { ErrorBanner } from "./components/ErrorBanner";
import { COLUMNS, groupTasks, sortTasks } from "./types";
import "./App.css";

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  error: "Error",
  stopped: "Stopped",
};

export default function App() {
  const ralph = useRalph();
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const panelWidthRef = useRef(400);
  panelWidthRef.current = panelWidth;

  const startResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.min(Math.max(startW + (startX - ev.clientX), 280), Math.round(window.innerWidth * 0.85));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  }, []);

  const groups = groupTasks(ralph.tasks.tasks);
  const pct =
    ralph.tasks.maxLLMCalls > 0
      ? Math.round((ralph.tasks.totalLLMCalls / ralph.tasks.maxLLMCalls) * 100)
      : 0;

  const isRunning = ralph.loopStatus.status === "running";
  const isError = ralph.loopStatus.status === "error";
  const showError = isError && !errorDismissed && ralph.loopStatus.error;

  // Setup gating: force settings open when not fully configured
  const isReady =
    ralph.readiness.repoConfigured &&
    ralph.readiness.requirementsFound &&
    ralph.readiness.epicConfigured;
  const settingsVisible = showSettings || !isReady;
  const canStart = isReady && !isRunning;

  function handleRestart() {
    setErrorDismissed(false);
    ralph.restartLoop();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">Ralph</h1>
          <span className={`loop-status loop-status--${ralph.loopStatus.status}`}>
            {STATUS_LABELS[ralph.loopStatus.status] || ralph.loopStatus.status}
          </span>
          {ralph.repoRoot && (
            <span className="app-header__repo" title={ralph.repoRoot}>
              {ralph.repoRoot.split("/").slice(-2).join("/")}
            </span>
          )}
        </div>

        <div className="app-header__stats">
          <div className="stat">
            <span className="stat__label">Task</span>
            <span className="stat__value">#{ralph.tasks.currentTaskNum || 0}</span>
          </div>
          <div className="stat">
            <span className="stat__label">LLM Calls</span>
            <span className="stat__value">
              {ralph.tasks.totalLLMCalls}/{ralph.tasks.maxLLMCalls}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Progress</span>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
              <span className="progress-bar__label">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="app-header__right">
          <div className="loop-controls">
            {isRunning ? (
              <button className="loop-btn loop-btn--stop" onClick={ralph.stopLoop}>
                Stop
              </button>
            ) : (
              <button
                className="loop-btn loop-btn--start"
                onClick={ralph.startLoop}
                disabled={!canStart}
                title={!isReady ? "Configure repository, requirements, and epic first" : undefined}
              >
                Start
              </button>
            )}
            <button
              className="loop-btn loop-btn--restart"
              onClick={handleRestart}
              disabled={!isRunning && !isError && ralph.loopStatus.status !== "stopped"}
            >
              Restart
            </button>
          </div>

          <button
            className={`icon-btn ${showLog ? "icon-btn--active" : ""}`}
            onClick={() => setShowLog(!showLog)}
            title="Toggle log"
          >
            {"\u2630"}
          </button>
          <button
            className={`icon-btn ${settingsVisible ? "icon-btn--active" : ""}`}
            onClick={() => setShowSettings(!settingsVisible)}
            title="Settings"
          >
            {"\u2699"}
          </button>

          <span className={`connection-dot ${ralph.connected ? "connection-dot--on" : ""}`}>
            {ralph.connected ? "live" : "..."}
          </span>
        </div>
      </header>

      {!isReady && (
        <div className="setup-banner">
          {!ralph.readiness.repoConfigured
            ? "Set a repository path in Settings to get started."
            : !ralph.readiness.requirementsFound
              ? ralph.settings.requirementsFile
                ? `Requirements file not found: ${ralph.settings.requirementsFile}. Create it or update the path in Settings.`
                : "No requirements file found. Add requirements.md to the repo root, or set a custom path in Settings."
              : "Fill out the current epic in Settings before starting the loop."}
        </div>
      )}

      {showError && (
        <ErrorBanner
          error={ralph.loopStatus.error!}
          onRestart={handleRestart}
          onDismiss={() => setErrorDismissed(true)}
        />
      )}

      <div className="app-body">
        <main className="kanban-board">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              tasks={sortTasks(groups[col.key] || [], ralph.settings.taskColumnSort)}
            />
          ))}
        </main>

        {settingsVisible && (
          <div className="settings-panel-wrapper" style={{ width: panelWidth }}>
            <div className="cp-resize-handle" onMouseDown={startResize} />
            <ControlPanel
              settings={ralph.settings}
              epic={ralph.epic}
              prompts={ralph.prompts}
              repoRoot={ralph.repoRoot}
              readiness={ralph.readiness}
              onSaveSettings={ralph.saveSettings}
              onSaveEpic={ralph.saveEpic}
              onSavePrompt={ralph.savePrompt}
              onSetRepo={ralph.setRepo}
              onRefreshBacklog={ralph.refreshBacklog}
              isRunning={isRunning}
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}
      </div>

      {showLog && (
        <LogViewer lines={ralph.log} onClose={() => setShowLog(false)} />
      )}
    </div>
  );
}
