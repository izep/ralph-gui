import { useState, useEffect } from "react";
import type { Settings, Readiness, AgentBackendId } from "../types";

const PROMPT_NAMES = [
  { key: "plan-prompt.md", label: "Plan" },
  { key: "dev-prompt.md", label: "Dev" },
  { key: "qa-prompt.md", label: "QA" },
];

function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  return "copilot";
}

export function ControlPanel({
  settings,
  epic,
  prompts,
  repoRoot,
  readiness,
  onSaveSettings,
  onSaveEpic,
  onSavePrompt,
  onSetRepo,
  onRefreshBacklog,
  isRunning,
  onClose,
}: {
  settings: Settings;
  epic: string;
  prompts: Record<string, string>;
  repoRoot: string;
  readiness: Readiness;
  onSaveSettings: (s: Settings) => Promise<void>;
  onSaveEpic: (content: string) => Promise<void>;
  onSavePrompt: (name: string, content: string) => Promise<void>;
  onSetRepo: (path: string) => Promise<{ ok: boolean; error?: string }>;
  onRefreshBacklog: () => Promise<{ ok: boolean; error?: string }>;
  isRunning: boolean;
  onClose: () => void;
}) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [localEpic, setLocalEpic] = useState(epic);
  const [localRepo, setLocalRepo] = useState(repoRoot);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [epicSaved, setEpicSaved] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [activePrompt, setActivePrompt] = useState(PROMPT_NAMES[0].key);
  const [localPrompt, setLocalPrompt] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const repoLocked = !readiness.repoConfigured;

  const canClose = readiness.repoConfigured && readiness.requirementsFound;

  // Sync from server when props change
  useEffect(
    () => setLocalSettings({ ...settings, agentBackend: normalizeAgentBackend(settings.agentBackend) }),
    [settings],
  );
  useEffect(() => setLocalEpic(epic), [epic]);
  useEffect(() => setLocalRepo(repoRoot), [repoRoot]);
  useEffect(() => setLocalPrompt(prompts[activePrompt] ?? ""), [prompts, activePrompt]);

  async function handleSaveSettings() {
    await onSaveSettings(localSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  async function handleSaveEpic() {
    await onSaveEpic(localEpic);
    setEpicSaved(true);
    setTimeout(() => setEpicSaved(false), 2000);
  }

  async function handleRefreshBacklog() {
    setRefreshing(true);
    try {
      await onRefreshBacklog();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSetRepo() {
    setRepoError("");
    const result = await onSetRepo(localRepo);
    if (!result.ok) setRepoError(result.error ?? "Failed to set repository");
  }

  return (
    <aside className="control-panel">
      <div className="control-panel__header">
        <h2>Settings</h2>
        {canClose && (
          <button className="control-panel__close" onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <section className="control-panel__section">
        <h3>Repository</h3>
        <label className="cp-field">
          <span>Repo Root Path</span>
          <input
            type="text"
            value={localRepo}
            onChange={(e) => setLocalRepo(e.target.value)}
            placeholder="/path/to/your/project"
          />
        </label>
        {repoError && <p className="cp-error">{repoError}</p>}
        <button className="cp-btn" onClick={handleSetRepo}>
          Set Repository
        </button>
        {readiness.repoConfigured && (
          <div className="cp-status">
            {readiness.gitBranch && (
              <div className="cp-branch">
                Branch: <code>{readiness.gitBranch}</code>
              </div>
            )}
          </div>
        )}

        <label className="cp-field">
          <span>Requirements File</span>
          <input
            type="text"
            value={localSettings.requirementsFile}
            onChange={(e) => setLocalSettings({ ...localSettings, requirementsFile: e.target.value })}
            placeholder={readiness.requirementsFile ?? "Auto-discovered"}
            disabled={repoLocked}
          />
        </label>
        <p className="cp-hint">
          Path to your requirements document, relative to the repo root. Leave blank to auto-discover (looks for <code>requirements.md</code> in common locations).
          Ralph injects this file's content into every prompt as authoritative product requirements.
        </p>
        {readiness.repoConfigured && (
          readiness.requirementsFound ? (
            <span className="cp-status--ok">✓ Requirements: {readiness.requirementsFile}</span>
          ) : (
            <span className="cp-status--warn">
              ⚠ Requirements file not found
              {localSettings.requirementsFile ? `: ${localSettings.requirementsFile}` : " (auto-discovery failed)"}
            </span>
          )
        )}
      </section>

      <section className="control-panel__section">
        <h3>Loop Configuration</h3>
        {repoLocked && (
          <p className="cp-hint">Set Repository first to edit loop settings.</p>
        )}

        <fieldset className="cp-fieldset" disabled={repoLocked}>

        <label className="cp-field">
          <span>Agent Backend</span>
          <select
            value={localSettings.agentBackend}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, agentBackend: normalizeAgentBackend(e.target.value) })
            }
          >
            <option value="copilot">GitHub Copilot CLI</option>
            <option value="cursor-agent">Cursor Agent</option>
            <option value="claude">Claude Code (claude CLI)</option>
            <option value="gemini">Google Gemini CLI</option>
          </select>
        </label>

        <label className="cp-field">
          <span>Max LLM Calls</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={localSettings.maxLLMCalls}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, maxLLMCalls: Number(e.target.value) })
            }
          />
        </label>

        <label className="cp-field">
          <span>Plan Model</span>
          <input
            type="text"
            value={localSettings.planModel}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, planModel: e.target.value })
            }
          />
        </label>

        <label className="cp-field">
          <span>Dev Model</span>
          <input
            type="text"
            value={localSettings.devModel}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, devModel: e.target.value })
            }
          />
        </label>

        <label className="cp-field">
          <span>QA Model</span>
          <input
            type="text"
            value={localSettings.qaModel}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, qaModel: e.target.value })
            }
          />
        </label>

        <label className="cp-field">
          <span>Dev Reasoning Effort</span>
          <select
            value={localSettings.devReasoningEffort}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, devReasoningEffort: e.target.value })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra High</option>
          </select>
        </label>

        <label className="cp-field">
          <span>QA Reasoning Effort</span>
          <select
            value={localSettings.qaReasoningEffort}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, qaReasoningEffort: e.target.value })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra High</option>
          </select>
        </label>

        <label className="cp-field">
          <span>Plan Frequency (every N tasks)</span>
          <input
            type="number"
            min={1}
            max={100}
            value={localSettings.planFrequency}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, planFrequency: Number(e.target.value) })
            }
          />
        </label>

        <label className="cp-field">
          <span>Min Backlog Size (re-plan trigger)</span>
          <input
            type="number"
            min={0}
            max={50}
            value={localSettings.minBacklogSize}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, minBacklogSize: Number(e.target.value) })
            }
          />
        </label>

        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.autoCommit}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, autoCommit: e.target.checked })
            }
          />
          <span>Auto-commit after each verified task</span>
        </label>

        <button className="cp-btn" onClick={handleSaveSettings}>
          {settingsSaved ? "Saved!" : "Save Settings"}
        </button>
        </fieldset>
      </section>

      <section className="control-panel__section">
        <h3>Current Epic</h3>
        {repoLocked && (
          <p className="cp-hint">Set Repository first to edit the epic.</p>
        )}
        {!repoLocked && !readiness.epicConfigured && (
          <p className="cp-hint">The loop cannot start until this epic is filled out.</p>
        )}
        <fieldset className="cp-fieldset" disabled={repoLocked}>
        <label className="cp-field">
          <span>Epic File</span>
          <input
            type="text"
            value={localSettings.epicFile}
            onChange={(e) => setLocalSettings({ ...localSettings, epicFile: e.target.value })}
            placeholder="ralph/epic.md"
          />
        </label>
        <p className="cp-hint">
          Path to the epic file, relative to the repo root. This is your living product document describing the current feature or goal.
          Ralph reads it to plan tasks and injects its content into every prompt. You own this file — edit it freely between sessions.
        </p>
        <textarea
          className="cp-textarea"
          rows={8}
          value={localEpic}
          onChange={(e) => setLocalEpic(e.target.value)}
          placeholder="Describe the current epic, scope boundaries, and success criteria..."
        />
        <button className="cp-btn" onClick={handleSaveEpic}>
          {epicSaved ? "Saved!" : "Save Epic"}
        </button>
        <button
          className="cp-btn cp-btn--secondary"
          onClick={handleRefreshBacklog}
          disabled={refreshing || isRunning}
          title={isRunning ? "Stop the loop first to refresh tasks" : "Re-run planning to refresh the backlog"}
        >
          {refreshing ? "Refreshing..." : "Refresh Tasks"}
        </button>
        </fieldset>
      </section>

      <section className="control-panel__section">
        <h3>Prompts</h3>
        {repoLocked && (
          <p className="cp-hint">Set Repository first to edit prompts.</p>
        )}
        <fieldset className="cp-fieldset" disabled={repoLocked}>
        <p className="cp-hint">
          Edit the prompts used for each loop phase. Saved to the target repo's ralph/ folder.
          Changes apply on the next iteration.
        </p>
        <div className="cp-tabs">
          {PROMPT_NAMES.map((p) => (
            <button
              key={p.key}
              className={`cp-tab ${activePrompt === p.key ? "cp-tab--active" : ""}`}
              onClick={() => setActivePrompt(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          className="cp-textarea cp-textarea--mono"
          rows={12}
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
        />
        <button
          className="cp-btn"
          onClick={async () => {
            await onSavePrompt(activePrompt, localPrompt);
            setPromptSaved(true);
            setTimeout(() => setPromptSaved(false), 2000);
          }}
        >
          {promptSaved ? "Saved!" : `Save ${PROMPT_NAMES.find((p) => p.key === activePrompt)?.label} Prompt`}
        </button>
        </fieldset>
      </section>
    </aside>
  );
}
