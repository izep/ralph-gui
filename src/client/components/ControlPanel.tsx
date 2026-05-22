import { useState, useEffect } from "react";
import type { Settings, Readiness } from "../types";
import { RepositorySection } from "./RepositorySection";
import { LoopConfigSection, normalizeAgentBackend } from "./LoopConfigSection";
import { EpicSection } from "./EpicSection";
import { PromptsSection } from "./PromptsSection";
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
  const [localPrompt, setLocalPrompt] = useState("");
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

  useEffect(() => {
    onSettingsDraftChange?.(localSettings);
  }, [localSettings, onSettingsDraftChange]);

  // Dirty detection: compare local draft to last-saved server state
  const dockerDirty = isDockerDirty(localSettings, settings);
  const loopDirty = isLoopDirty(localSettings, settings);
  const epicDirty = localEpic !== epic || localSettings.epicFile !== settings.epicFile;
  const promptDirty = localPrompt !== (prompts[activePrompt] ?? "");

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
    setLocalPrompt(prompts[activePrompt] ?? "");
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

  const [expandedMap, setExpandedMap] = useState<Record<'docker'|'loop'|'epic'|'prompts', boolean>>({
    docker: true,
    loop: true,
    epic: true,
    prompts: true,
  });

  function collapseAll() {
    setExpandedMap({ docker: false, loop: false, epic: false, prompts: false });
  }
  function expandAll() {
    setExpandedMap({ docker: true, loop: true, epic: true, prompts: true });
  }
  function toggle(id: 'docker'|'loop'|'epic'|'prompts') {
    setExpandedMap((m) => ({ ...m, [id]: !m[id] }));
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

      <div className="control-panel__header-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 8 }}>
        <button className="loop-btn" onClick={collapseAll} type="button">
          Collapse all
        </button>
        <button className="loop-btn" onClick={expandAll} type="button">
          Expand all
        </button>
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
          onActivePromptChange={setActivePrompt}
          localPrompt={localPrompt}
          onLocalPromptChange={setLocalPrompt}
          promptDirty={promptDirty}
          onSavePrompt={handleSavePrompt}
          onResetPrompt={handleResetPrompt}
          suppressHeader
        />
      </CollapsibleSection>
    </aside>
  );
}
