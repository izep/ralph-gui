import { useEffect, useState } from "react";
import type { Settings, AgentBackendId, TaskColumnSort } from "../types";
// @ts-ignore - shared catalog lives outside client project include; import for runtime only
import { AGENT_MODEL_CATALOG, PREFERRED_MODELS_BY_BACKEND, isModelInCatalog } from "../../shared/agent-models";

export function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  return "copilot";
}

export const FLEET_CAPABLE_BACKENDS = ["copilot"] as const satisfies readonly AgentBackendId[];

export function backendSupportsFleetMode(backend: AgentBackendId): boolean {
  return (FLEET_CAPABLE_BACKENDS as readonly string[]).includes(backend);
}

export function LoopConfigSection({
  localSettings,
  onChangeSettings,
  repoLocked,
  settingsSaved,
  onSaveSettings,
}: {
  localSettings: Settings;
  onChangeSettings: (s: Settings) => void;
  repoLocked: boolean;
  settingsSaved: boolean;
  onSaveSettings: () => void;
}) {

  const BACKEND_DISPLAY_NAMES: Record<AgentBackendId, string> = {
    copilot: 'GitHub Copilot CLI',
    'cursor-agent': 'Cursor',
    claude: 'Claude Code CLI',
    gemini: 'Gemini CLI',
  };

  const [planIsCustom, setPlanIsCustom] = useState<boolean>(() =>
    !isModelInCatalog(localSettings.agentBackend, localSettings.planModel)
  );
  const [devIsCustom, setDevIsCustom] = useState<boolean>(() =>
    !isModelInCatalog(localSettings.agentBackend, localSettings.devModel)
  );
  const [qaIsCustom, setQaIsCustom] = useState<boolean>(() =>
    !isModelInCatalog(localSettings.agentBackend, localSettings.qaModel)
  );

  useEffect(() => {
    // When backend changes, if current models are not in the new catalog, replace with preferred defaults
    const backend = localSettings.agentBackend;
    const preferred = PREFERRED_MODELS_BY_BACKEND[backend];
    const updates: Partial<Settings> = {};
    let changed = false;

    if (!isModelInCatalog(backend, localSettings.planModel)) {
      updates.planModel = preferred.plan;
      setPlanIsCustom(false);
      changed = true;
    } else {
      setPlanIsCustom(false);
    }

    if (!isModelInCatalog(backend, localSettings.devModel)) {
      updates.devModel = preferred.dev;
      setDevIsCustom(false);
      changed = true;
    } else {
      setDevIsCustom(false);
    }

    if (!isModelInCatalog(backend, localSettings.qaModel)) {
      updates.qaModel = preferred.qa;
      setQaIsCustom(false);
      changed = true;
    } else {
      setQaIsCustom(false);
    }

    if (changed) {
      onChangeSettings({ ...localSettings, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSettings.agentBackend]);

  const catalog = AGENT_MODEL_CATALOG[localSettings.agentBackend] || [];

  function renderOption(entry: { id: string; label: string; preferredFor: string[] }, role: 'Planning' | 'Dev' | 'QA') {
    const rec = entry.preferredFor.includes(role);
    const suffix = rec ? ` — recommended for ${role.toLowerCase()}` : '';
    return (
      <option key={entry.id} value={entry.id}>
        {entry.label} ({entry.id}){suffix}
      </option>
    );
  }

  return (
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
            onChangeSettings({ ...localSettings, agentBackend: normalizeAgentBackend(e.target.value) })
          }
        >
          <option value="copilot">GitHub Copilot CLI</option>
          <option value="cursor-agent">Cursor Agent</option>
          <option value="claude">Claude Code (claude CLI)</option>
          <option value="gemini">Google Gemini CLI</option>
        </select>
      </label>

      <label className="cp-field cp-field--row">
        <input
          type="checkbox"
          checked={localSettings.fleetMode}
          disabled={!backendSupportsFleetMode(localSettings.agentBackend)}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, fleetMode: e.target.checked })
          }
        />
        <span>Fleet mode</span>
      </label>
      {!backendSupportsFleetMode(localSettings.agentBackend) ? (
        <p className="cp-hint">Only available for agents that support parallel subagents (currently GitHub Copilot CLI).</p>
      ) : (
        <p className="cp-hint">Uses Copilot /fleet on dev/QA; may increase premium request usage.</p>
      )}

      <label className="cp-field">
        <span>Max LLM Calls</span>
        <input
          type="number"
          min={1}
          max={1000}
          value={localSettings.maxLLMCalls}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, maxLLMCalls: Number(e.target.value) })
          }
        />
      </label>


      // Plan select
      <label className="cp-field">
        <span>Plan Model</span>
        <select
          value={isModelInCatalog(localSettings.agentBackend, localSettings.planModel) ? localSettings.planModel : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setPlanIsCustom(true);
              onChangeSettings({ ...localSettings, planModel: "" });
            } else {
              setPlanIsCustom(false);
              onChangeSettings({ ...localSettings, planModel: v });
            }
          }}
        >
          {catalog.map((entry) => renderOption(entry, 'Planning'))}
          <option value="__custom__">Custom…</option>
        </select>
        {planIsCustom && (
          <input
            type="text"
            value={localSettings.planModel}
            placeholder="Custom model id"
            onChange={(e) => onChangeSettings({ ...localSettings, planModel: e.target.value })}
          />
        )}
      </label>

      {/* Dev select */}
      <label className="cp-field">
        <span>Dev Model</span>
        <select
          value={isModelInCatalog(localSettings.agentBackend, localSettings.devModel) ? localSettings.devModel : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setDevIsCustom(true);
              onChangeSettings({ ...localSettings, devModel: "" });
            } else {
              setDevIsCustom(false);
              onChangeSettings({ ...localSettings, devModel: v });
            }
          }}
        >
          {catalog.map((entry) => renderOption(entry, 'Dev'))}
          <option value="__custom__">Custom…</option>
        </select>
        {devIsCustom && (
          <input
            type="text"
            value={localSettings.devModel}
            placeholder="Custom model id"
            onChange={(e) => onChangeSettings({ ...localSettings, devModel: e.target.value })}
          />
        )}
      </label>

      {/* QA select */}
      <label className="cp-field">
        <span>QA Model</span>
        <select
          value={isModelInCatalog(localSettings.agentBackend, localSettings.qaModel) ? localSettings.qaModel : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setQaIsCustom(true);
              onChangeSettings({ ...localSettings, qaModel: "" });
            } else {
              setQaIsCustom(false);
              onChangeSettings({ ...localSettings, qaModel: v });
            }
          }}
        >
          {catalog.map((entry) => renderOption(entry, 'QA'))}
          <option value="__custom__">Custom…</option>
        </select>
        {qaIsCustom && (
          <input
            type="text"
            value={localSettings.qaModel}
            placeholder="Custom model id"
            onChange={(e) => onChangeSettings({ ...localSettings, qaModel: e.target.value })}
          />
        )}
      </label>

      <p className="cp-hint">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            const url = `/models-reference?backend=${localSettings.agentBackend}`;
            window.open(url, '_blank', 'noopener,width=960,height=720');
          }}
        >
          View models for {BACKEND_DISPLAY_NAMES[localSettings.agentBackend]}
        </a>
      </p>

      <label className="cp-field">
        <span>Dev Reasoning Effort</span>
        <select
          value={localSettings.devReasoningEffort}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, devReasoningEffort: e.target.value })
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
            onChangeSettings({ ...localSettings, qaReasoningEffort: e.target.value })
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
            onChangeSettings({ ...localSettings, planFrequency: Number(e.target.value) })
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
            onChangeSettings({ ...localSettings, minBacklogSize: Number(e.target.value) })
          }
        />
      </label>

      <label className="cp-field">
        <span>Task Column Sort</span>
        <select
          value={localSettings.taskColumnSort}
          onChange={(e) =>
            onChangeSettings({
              ...localSettings,
              taskColumnSort: e.target.value as TaskColumnSort,
            })
          }
        >
          <option value="updatedAtAsc">Last edit (oldest first)</option>
          <option value="updatedAtDesc">Last edit (newest first)</option>
          <option value="idAsc">Task id (low to high)</option>
          <option value="idDesc">Task id (high to low)</option>
        </select>
      </label>

      <label className="cp-field cp-field--row">
        <input
          type="checkbox"
          checked={localSettings.autoCommit}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, autoCommit: e.target.checked })
          }
        />
        <span>Auto-commit after each verified task</span>
      </label>
      <label className="cp-field cp-field--row">
        <input
          type="checkbox"
          checked={localSettings.pauseAfterPlan}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, pauseAfterPlan: e.target.checked })
          }
        />
        <span>Pause after first planning phase</span>
      </label>
      <p className="cp-hint">
        Stops the loop after the initial backlog is generated so you can review tasks before development begins.
      </p>

      <button className="cp-btn" onClick={onSaveSettings}>
        {settingsSaved ? "Saved!" : "Save Settings"}
      </button>
      </fieldset>
    </section>
  );
}
