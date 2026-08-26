import { useState, useEffect, useRef } from "react";
import type { Settings, Readiness } from "../types";
import { RepositorySection } from "./RepositorySection";
import {
  LoopConfigSection,
  normalizeAgentBackend,
  normalizeCopilotOutputFormat,
} from "./LoopConfigSection";
import { EpicSection } from "./EpicSection";
import { PromptsSection, promptLabel } from "./PromptsSection";
import { DockerSection } from "./DockerSection";
import { CollapsibleSection } from "./CollapsibleSection";
import { isDockerDirty, isLoopDirty, pickDockerSettings, pickLoopSettings } from "../control-panel-dirty";

const DEFAULT_PROMPT_KEY = "plan-prompt.md";

export function ControlPanel({
  settings,
  onSettingsDraftChange,
  epic,
  prompts,
  repoRoot,
  readiness,
  onSaveSettings,
  onSaveEpic,
  onSavePrompt,
  onSetRepo,
  onRefreshBacklog,
  onSetEpicFile,
  onCreateEpicFile,
  onValidateDocker,
  onMergeEpicWork,
  isRunning,
  onClose,
}: {
  settings: Settings;
  onSettingsDraftChange?: (s: Settings) => void;
  epic: string;
  prompts: Record<string, string>;
  repoRoot: string;
  readiness: Readiness;
  onSaveSettings: (s: Settings) => Promise<void>;
  onSaveEpic: (content: string) => Promise<void>;
  onSavePrompt: (name: string, content: string) => Promise<void>;
  onSetRepo: (path: string) => Promise<{ ok: boolean; error?: string }>;
  onRefreshBacklog: () => Promise<{ ok: boolean; error?: string }>;
  onSetEpicFile: (path: string) => Promise<{ ok: boolean; content?: string; notFound?: boolean }>;
  onCreateEpicFile: (path: string) => Promise<{ ok: boolean; content?: string }>;
  onValidateDocker: () => Promise<{ ok: boolean; reason?: string; message?: string }>;
  onMergeEpicWork: () => Promise<{ ok: boolean; conflicts?: string[]; error?: string }>;
  isRunning: boolean;
  onClose: () => void;
}) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [localEpic, setLocalEpic] = useState(epic);
  const [localRepo, setLocalRepo] = useState(repoRoot);
  const [repoError, setRepoError] = useState("");
  const [activePrompt, setActivePrompt] = useState(DEFAULT_PROMPT_KEY);
  const [localPrompt, setLocalPrompt] = useState(prompts[DEFAULT_PROMPT_KEY] ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const repoLocked = !readiness.repoConfigured;
  const settingsBaselineRef = useRef(settings);
  const epicBaselineRef = useRef(epic);
  const promptBaselineRef = useRef(prompts[DEFAULT_PROMPT_KEY] ?? "");

  const canClose = true;

  function normalizedSettings(s: Settings): Settings {
    return {
      ...s,
      agentBackend: normalizeAgentBackend(s.agentBackend),
      copilotOutputFormat: normalizeCopilotOutputFormat(s.copilotOutputFormat),
    };
  }

  // Sync from server when props change, but do not clobber dirty drafts.
  useEffect(
    () =>
      setLocalSettings((prev) => {
        const dirtyVsBaseline =
          isDockerDirty(prev, settingsBaselineRef.current) ||
          isLoopDirty(prev, settingsBaselineRef.current);
        const dirtyVsIncoming = isDockerDirty(prev, settings) || isLoopDirty(prev, settings);
        if (dirtyVsBaseline && dirtyVsIncoming) return prev;
        const next = normalizedSettings(settings);
        settingsBaselineRef.current = next;
        return next;
      }),
    [settings],
  );
  useEffect(() => {
    setLocalEpic((prev) => {
      const dirty = prev !== epicBaselineRef.current;
      if (dirty && prev !== epic) return prev;
      epicBaselineRef.current = epic;
      return epic;
    });
  }, [epic]);
  useEffect(() => {
    setLocalRepo(repoRoot);
    setLocalSettings(normalizedSettings(settings));
    settingsBaselineRef.current = normalizedSettings(settings);
    setLocalEpic(epic);
    epicBaselineRef.current = epic;
    const incomingPrompt = prompts[activePrompt] ?? "";
    setLocalPrompt(incomingPrompt);
    promptBaselineRef.current = incomingPrompt;
  }, [repoRoot]);
  useEffect(() => {
    const incoming = prompts[activePrompt] ?? "";
    setLocalPrompt((prev) => {
      // Empty local + server content is a load, not a user-cleared draft.
      // Dev Strict Mode can mutate the baseline ref before the first setState flushes.
      if (prev === "" && incoming !== "") {
        promptBaselineRef.current = incoming;
        return incoming;
      }
      const dirty = prev !== promptBaselineRef.current;
      if (dirty && prev !== incoming) return prev;
      promptBaselineRef.current = incoming;
      return incoming;
    });
    // Tab switches apply the selected file in handleActivePromptChange so this
    // effect does not treat the previous persona's text as a dirty draft.
  }, [prompts]);

  useEffect(() => {
    onSettingsDraftChange?.(localSettings);
  }, [localSettings, onSettingsDraftChange]);

  // Dirty detection: compare local draft to last-saved server state
  const dockerDirty = isDockerDirty(localSettings, settings);
  const loopDirty = isLoopDirty(localSettings, settings);
  const epicDirty = localEpic !== epic || localSettings.epicFile !== settings.epicFile;
  const promptDirty = localPrompt !== (prompts[activePrompt] ?? "");

  function applyPrompt(key: string) {
    const incoming = prompts[key] ?? "";
    setActivePrompt(key);
    setLocalPrompt(incoming);
    promptBaselineRef.current = incoming;
  }

  function handleActivePromptChange(nextKey: string) {
    if (nextKey === activePrompt) return;
    if (promptDirty) {
      window.alert(
        `Save or reset the ${promptLabel(activePrompt)} prompt before switching to ${promptLabel(nextKey)}.`,
      );
      return;
    }
    applyPrompt(nextKey);
  }

  async function handleSaveDocker() {
    const merged: Settings = { ...settings, ...pickDockerSettings(localSettings) };
    await onSaveSettings(merged);
  }

  async function handleSaveLoop() {
    const withUpdatedModels: Partial<Settings> = {
      ...pickLoopSettings(localSettings),
      savedModelsByBackend: {
        ...localSettings.savedModelsByBackend,
        [localSettings.agentBackend]: {
          planModel: localSettings.planModel,
          devModel: localSettings.devModel,
          qaModel: localSettings.qaModel,
        },
      },
    };
    const merged: Settings = { ...settings, ...withUpdatedModels };
    setLocalSettings((prev) => ({ ...prev, ...withUpdatedModels }));
    await onSaveSettings(merged);
  }

  async function handleSaveEpic() {
    // Persist epic markdown content
    await onSaveEpic(localEpic);
    // Also persist epicFile path if it changed
    if (localSettings.epicFile !== settings.epicFile) {
      const merged: Settings = { ...settings, ...pickLoopSettings(localSettings) };
      await onSaveSettings(merged);
    }
  }

  function handleResetDocker() {
    setLocalSettings((prev) => ({ ...prev, ...pickDockerSettings(settings) }));
  }

  function handleResetLoop() {
    setLocalSettings((prev) => ({ ...prev, ...pickLoopSettings(settings) }));
  }

  function handleResetEpic() {
    setLocalEpic(epic);
    setLocalSettings((prev) => ({ ...prev, epicFile: settings.epicFile }));
  }

  function handleResetPrompt() {
    const incoming = prompts[activePrompt] ?? "";
    setLocalPrompt(incoming);
    promptBaselineRef.current = incoming;
  }

  async function handleSavePrompt() {
    await onSavePrompt(activePrompt, localPrompt);
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

  const [expandedMap, setExpandedMap] = useState<Record<'docker' | 'loop' | 'epic' | 'prompts', boolean>>({
    docker: false,
    loop: false,
    epic: false,
    prompts: false,
  });

  function collapseAll() {
    setExpandedMap({ docker: false, loop: false, epic: false, prompts: false });
  }
  function expandAll() {
    setExpandedMap({ docker: true, loop: true, epic: true, prompts: true });
  }
  function toggle(id: 'docker' | 'loop' | 'epic' | 'prompts') {
    setExpandedMap((m) => ({ ...m, [id]: !m[id] }));
  }

  return (
    <aside className="control-panel">
      <div className="control-panel__header">
        <div className="control-panel__header-top">
          <h2>Settings</h2>
          {canClose && (
            <button className="control-panel__close" onClick={onClose} type="button" aria-label="Close settings">
              &times;
            </button>
          )}
        </div>
        <div className="control-panel__header-toolbar">
          <button className="control-panel__toolbar-btn" onClick={collapseAll} type="button">
            Collapse all
          </button>
          <button className="control-panel__toolbar-btn" onClick={expandAll} type="button">
            Expand all
          </button>
        </div>
      </div>

      <RepositorySection
        localRepo={localRepo}
        onLocalRepoChange={setLocalRepo}
        repoError={repoError}
        onSetRepo={handleSetRepo}
        readiness={readiness}
        requirementsFile={localSettings.requirementsFile}
        onRequirementsFileChange={(v) => setLocalSettings({ ...localSettings, requirementsFile: v })}
      />

      <CollapsibleSection id="loop" title="Loop Configuration" expanded={expandedMap.loop} onToggle={() => toggle('loop')}>
        <LoopConfigSection
          localSettings={localSettings}
          onChangeSettings={setLocalSettings}
          repoLocked={repoLocked}
          loopDirty={loopDirty}
          onSaveSettings={handleSaveLoop}
          onResetLoop={handleResetLoop}
          suppressHeader
        />
      </CollapsibleSection>

      <CollapsibleSection id="epic" title="Current Epic" expanded={expandedMap.epic} onToggle={() => toggle('epic')}>
        <EpicSection
          localEpic={localEpic}
          onLocalEpicChange={setLocalEpic}
          epicFile={localSettings.epicFile}
          onEpicFileChange={(v) => setLocalSettings({ ...localSettings, epicFile: v })}
          repoLocked={repoLocked}
          epicConfigured={readiness.epicConfigured}
          epicDirty={epicDirty}
          onSaveEpic={handleSaveEpic}
          onResetEpic={handleResetEpic}
          onRefreshBacklog={handleRefreshBacklog}
          refreshing={refreshing}
          isRunning={isRunning}
          onSetEpicFile={onSetEpicFile}
          onCreateEpicFile={onCreateEpicFile}
          suppressHeader
        />
      </CollapsibleSection>

      <CollapsibleSection id="prompts" title="Prompts" expanded={expandedMap.prompts} onToggle={() => toggle('prompts')}>
        <PromptsSection
          repoLocked={repoLocked}
          activePrompt={activePrompt}
          onActivePromptChange={handleActivePromptChange}
          localPrompt={localPrompt}
          onLocalPromptChange={setLocalPrompt}
          promptDirty={promptDirty}
          onSavePrompt={handleSavePrompt}
          onResetPrompt={handleResetPrompt}
          suppressHeader
        />
      </CollapsibleSection>

      <CollapsibleSection id="docker" title="Docker Agents" expanded={expandedMap.docker} onToggle={() => toggle('docker')}>
        <DockerSection
          localSettings={localSettings}
          onChangeSettings={setLocalSettings}
          readiness={readiness}
          repoLocked={repoLocked}
          isRunning={isRunning}
          onValidateDocker={onValidateDocker}
          onMergeEpicWork={onMergeEpicWork}
          dockerDirty={dockerDirty}
          onSaveDocker={handleSaveDocker}
          onResetDocker={handleResetDocker}
          suppressHeader
        />
      </CollapsibleSection>
    </aside>
  );
}
