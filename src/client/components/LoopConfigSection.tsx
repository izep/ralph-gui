import { useEffect, useState } from "react";
import type { Settings, AgentBackendId, TaskColumnSort } from "../types";
import {
  AGENT_MODEL_CATALOG,
  formatModelOptionLabel,
  isModelInCatalog,
  resolveModelsForBackend,
  withSavedModelsForBackend,
  type ModelRole,
} from "../../shared/agent-models";
import { normalizeCopilotOutputFormat } from "../../shared/copilotLogFormat";

export function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  if (v === "opencode") return "opencode";
  return "copilot";
}

export const FLEET_CAPABLE_BACKENDS = ["copilot", "claude"] as const satisfies readonly AgentBackendId[];

export function backendSupportsFleetMode(backend: AgentBackendId): boolean {
  return (FLEET_CAPABLE_BACKENDS as readonly string[]).includes(backend);
}

function syncCustomFlags(
  backend: AgentBackendId,
  planModel: string,
  devModel: string,
  qaModel: string,
): { planIsCustom: boolean; devIsCustom: boolean; qaIsCustom: boolean } {
  return {
    planIsCustom: !isModelInCatalog(backend, planModel),
    devIsCustom: !isModelInCatalog(backend, devModel),
    qaIsCustom: !isModelInCatalog(backend, qaModel),
  };
}

export { normalizeCopilotOutputFormat };

export function LoopConfigSection({
  localSettings,
  onChangeSettings,
  repoLocked,
  loopDirty,
  onSaveSettings,
  onResetLoop,
  suppressHeader,
}: {
  localSettings: Settings;
  onChangeSettings: (s: Settings) => void;
  repoLocked: boolean;
  loopDirty?: boolean;
  onSaveSettings: () => void;
  onResetLoop?: () => void;
  suppressHeader?: boolean;
}) {
  const BACKEND_DISPLAY_NAMES: Record<AgentBackendId, string> = {
    copilot: "GitHub Copilot CLI",
    "cursor-agent": "Cursor",
    claude: "Claude Code CLI",
    gemini: "Gemini CLI",
    opencode: "OpenCode CLI",
  };

  const [{ planIsCustom, devIsCustom, qaIsCustom }, setCustomFlags] = useState(() =>
    syncCustomFlags(
      localSettings.agentBackend,
      localSettings.planModel,
      localSettings.devModel,
      localSettings.qaModel,
    ),
  );

  useEffect(() => {
    setCustomFlags(
      syncCustomFlags(
        localSettings.agentBackend,
        localSettings.planModel,
        localSettings.devModel,
        localSettings.qaModel,
      ),
    );
  }, [
    localSettings.agentBackend,
    localSettings.planModel,
    localSettings.devModel,
    localSettings.qaModel,
  ]);

  const catalog = AGENT_MODEL_CATALOG[localSettings.agentBackend] || [];

  function handleAgentBackendChange(nextBackend: AgentBackendId) {
    const previousBackend = localSettings.agentBackend;
    if (nextBackend === previousBackend) return;

    const saved = withSavedModelsForBackend(localSettings.savedModelsByBackend, previousBackend, {
      planModel: localSettings.planModel,
      devModel: localSettings.devModel,
      qaModel: localSettings.qaModel,
    });

    const { planModel, devModel, qaModel } = resolveModelsForBackend(nextBackend, saved);

    onChangeSettings({
      ...localSettings,
      agentBackend: nextBackend,
      savedModelsByBackend: saved,
      planModel,
      devModel,
      qaModel,
    });
    setCustomFlags(syncCustomFlags(nextBackend, planModel, devModel, qaModel));
  }

  function renderModelSelect(
    role: ModelRole,
    label: string,
    modelKey: "planModel" | "devModel" | "qaModel",
    isCustom: boolean,
    setIsCustom: (v: boolean) => void,
  ) {
    const modelId = localSettings[modelKey];
    const selectValue = isModelInCatalog(localSettings.agentBackend, modelId)
      ? modelId
      : "__custom__";

    return (
      <label className="cp-field">
        <span>{label}</span>
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setIsCustom(true);
              onChangeSettings({ ...localSettings, [modelKey]: "" });
            } else {
              setIsCustom(false);
              onChangeSettings({ ...localSettings, [modelKey]: v });
            }
          }}
        >
          {catalog.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {formatModelOptionLabel(entry, role)}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={modelId}
            placeholder="Custom model id"
            onChange={(e) => onChangeSettings({ ...localSettings, [modelKey]: e.target.value })}
          />
        )}
      </label>
    );
  }

  return (
    <section className="control-panel__section">
      {!suppressHeader && <h3>Loop Configuration</h3>}
      {repoLocked && (
        <p className="cp-hint">Set Repository first to edit loop settings.</p>
      )}

      <fieldset className="cp-fieldset" disabled={repoLocked}>
        <label className="cp-field">
          <span>Agent Backend</span>
          <select
            value={localSettings.agentBackend}
            onChange={(e) => handleAgentBackendChange(normalizeAgentBackend(e.target.value))}
          >
            <option value="copilot">GitHub Copilot CLI</option>
            <option value="cursor-agent">Cursor Agent</option>
            <option value="claude">Claude Code (claude CLI)</option>
            <option value="gemini">Google Gemini CLI</option>
            <option value="opencode">OpenCode CLI</option>
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
          <p className="cp-hint">
            Only available for agents whose Fleet Mode is Yes (GitHub Copilot CLI and Claude Code).
          </p>
        ) : localSettings.agentBackend === "claude" ? (
          <p className="cp-hint">Uses Claude Code parallel subagents on dev/QA.</p>
        ) : (
          <p className="cp-hint">Uses Copilot /fleet on dev/QA; may increase premium request usage.</p>
        )}

        {localSettings.agentBackend === "copilot" && (
          <label className="cp-field">
            <span>Copilot Log Format</span>
            <select
              value={localSettings.copilotOutputFormat}
              onChange={(e) =>
                onChangeSettings({
                  ...localSettings,
                  copilotOutputFormat: normalizeCopilotOutputFormat(e.target.value),
                })
              }
            >
              <option value="streaming">Streaming JSONL (structured viewer)</option>
              <option value="json">JSON batch (structured viewer)</option>
              <option value="text">Plain text</option>
            </select>
          </label>
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

        <label className="cp-field">
          <span>Agent idle timeout (minutes)</span>
          <input
            type="number"
            min={0}
            max={180}
            value={localSettings.agentIdleTimeoutMinutes}
            onChange={(e) =>
              onChangeSettings({
                ...localSettings,
                agentIdleTimeoutMinutes: Number(e.target.value),
              })
            }
          />
        </label>
        <p className="cp-hint">
          Kill the host Copilot process if it produces no output for this long (thinking of a few
          minutes is normal). 0 disables. Live progress is written to ralph/run-status.json.
        </p>

        <label className="cp-field">
          <span>Agent wall-clock timeout (minutes)</span>
          <input
            type="number"
            min={0}
            max={720}
            value={localSettings.agentTimeoutMinutes}
            onChange={(e) =>
              onChangeSettings({
                ...localSettings,
                agentTimeoutMinutes: Number(e.target.value),
              })
            }
          />
        </label>
        <p className="cp-hint">Hard cap on a single Copilot call. 0 disables.</p>

        <label className="cp-field">
          <span>Stuck-loop repeats</span>
          <input
            type="number"
            min={0}
            max={100}
            value={localSettings.agentMaxConsecutiveRepeats}
            onChange={(e) =>
              onChangeSettings({
                ...localSettings,
                agentMaxConsecutiveRepeats: Number(e.target.value),
              })
            }
          />
        </label>
        <p className="cp-hint">
          Kill Copilot if the same tool start repeats this many times in a row. 0 disables.
        </p>

        {renderModelSelect("Planning", "Plan Model", "planModel", planIsCustom, (v) =>
          setCustomFlags((f) => ({ ...f, planIsCustom: v })),
        )}
        {renderModelSelect("Dev", "Dev Model", "devModel", devIsCustom, (v) =>
          setCustomFlags((f) => ({ ...f, devIsCustom: v })),
        )}
        {renderModelSelect("QA", "QA Model", "qaModel", qaIsCustom, (v) =>
          setCustomFlags((f) => ({ ...f, qaIsCustom: v })),
        )}

        <p className="cp-hint">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const url = `/models-reference?backend=${localSettings.agentBackend}`;
              window.open(url, "_blank", "noopener,width=960,height=720");
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
          <span className="cp-hint">Applies to In Progress, In QA, and Done. Backlog is always lowest task number first.</span>
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
          Stops the loop after the initial backlog is generated so you can review tasks before
          development begins.
        </p>

        <div className="section-footer">
          <button
            className="cp-btn cp-btn--secondary"
            onClick={onResetLoop}
            disabled={!loopDirty}
            type="button"
          >
            Reset
          </button>
          <button className="cp-btn" onClick={onSaveSettings} disabled={!loopDirty} type="button">
            Save loop settings
          </button>
        </div>
      </fieldset>
    </section>
  );
}
