import { useState, useEffect } from "react";
import type { Settings, Readiness } from "../types";
import { RepositorySection } from "./RepositorySection";
import { LoopConfigSection, normalizeAgentBackend } from "./LoopConfigSection";
import { EpicSection } from "./EpicSection";
import { PromptsSection } from "./PromptsSection";
import { DockerSection } from "./DockerSection";

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
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [epicSaved, setEpicSaved] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [activePrompt, setActivePrompt] = useState(DEFAULT_PROMPT_KEY);
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

  useEffect(() => {
    onSettingsDraftChange?.(localSettings);
  }, [localSettings, onSettingsDraftChange]);

  async function handleSaveSettings() {
    const toSave: Settings = {
      ...localSettings,
      savedModelsByBackend: {
        ...localSettings.savedModelsByBackend,
        [localSettings.agentBackend]: {
          planModel: localSettings.planModel,
          devModel: localSettings.devModel,
          qaModel: localSettings.qaModel,
        },
      },
    };
    setLocalSettings(toSave);
    await onSaveSettings(toSave);
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

  async function handleSavePrompt() {
    await onSavePrompt(activePrompt, localPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
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

      <RepositorySection
        localRepo={localRepo}
        onLocalRepoChange={setLocalRepo}
        repoError={repoError}
        onSetRepo={handleSetRepo}
        readiness={readiness}
        requirementsFile={localSettings.requirementsFile}
        onRequirementsFileChange={(v) => setLocalSettings({ ...localSettings, requirementsFile: v })}
      />

      <DockerSection
        localSettings={localSettings}
        onChangeSettings={setLocalSettings}
        readiness={readiness}
        repoLocked={repoLocked}
        isRunning={isRunning}
        onValidateDocker={onValidateDocker}
        onMergeEpicWork={onMergeEpicWork}
      />

      <LoopConfigSection
        localSettings={localSettings}
        onChangeSettings={setLocalSettings}
        repoLocked={repoLocked}
        settingsSaved={settingsSaved}
        onSaveSettings={handleSaveSettings}
      />

      <EpicSection
        localEpic={localEpic}
        onLocalEpicChange={setLocalEpic}
        epicFile={localSettings.epicFile}
        onEpicFileChange={(v) => setLocalSettings({ ...localSettings, epicFile: v })}
        repoLocked={repoLocked}
        epicConfigured={readiness.epicConfigured}
        epicSaved={epicSaved}
        onSaveEpic={handleSaveEpic}
        onRefreshBacklog={handleRefreshBacklog}
        refreshing={refreshing}
        isRunning={isRunning}
        onSetEpicFile={onSetEpicFile}
        onCreateEpicFile={onCreateEpicFile}
      />

      <PromptsSection
        repoLocked={repoLocked}
        activePrompt={activePrompt}
        onActivePromptChange={setActivePrompt}
        localPrompt={localPrompt}
        onLocalPromptChange={setLocalPrompt}
        promptSaved={promptSaved}
        onSavePrompt={handleSavePrompt}
      />
    </aside>
  );
}
