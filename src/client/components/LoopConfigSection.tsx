import type { Settings, AgentBackendId, TaskColumnSort } from "../types";
import { normalizeCopilotOutputFormat } from "../../shared/copilotLogFormat";

export function normalizeAgentBackend(value: string | undefined): AgentBackendId {
  const v = value?.trim().toLowerCase();
  if (v === "cursor-agent") return "cursor-agent";
  if (v === "claude") return "claude";
  if (v === "gemini") return "gemini";
  return "copilot";
}

export { normalizeCopilotOutputFormat };

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
        <span>Plan Model</span>
        <input
          type="text"
          value={localSettings.planModel}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, planModel: e.target.value })
          }
        />
      </label>

      <label className="cp-field">
        <span>Dev Model</span>
        <input
          type="text"
          value={localSettings.devModel}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, devModel: e.target.value })
          }
        />
      </label>

      <label className="cp-field">
        <span>QA Model</span>
        <input
          type="text"
          value={localSettings.qaModel}
          onChange={(e) =>
            onChangeSettings({ ...localSettings, qaModel: e.target.value })
          }
        />
      </label>

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
