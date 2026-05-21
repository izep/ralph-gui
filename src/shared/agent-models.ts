// Source of truth: docs/coding-agents-available-models.md
// Shared catalog between client and server. Duplicates AgentBackendId here to avoid circular imports.
// Model IDs must match each CLI's --model / -m flags (verified via cursor-agent models, Claude --help, Gemini CLI).

export type AgentBackendId = 'copilot' | 'cursor-agent' | 'claude' | 'gemini';

export type ModelRole = 'Planning' | 'Dev' | 'QA';

export interface AgentModelEntry {
  id: string;
  label: string;
  strength: string;
  tier: string;
  multiplier: string;
  yoloMode: string;
  fleetMode: string;
  preferredFor: ModelRole[];
}

export interface SavedModelsTriple {
  planModel: string;
  devModel: string;
  qaModel: string;
}

export type SavedModelsByBackend = Partial<Record<AgentBackendId, SavedModelsTriple>>;

/** Maps retired catalog IDs to current CLI IDs per backend. */
export const LEGACY_MODEL_ALIASES: Partial<Record<AgentBackendId, Record<string, string>>> = {
  'cursor-agent': {
    'cursor-small': 'composer-2.5-fast',
    'claude-haiku-4.5': 'claude-4.5-sonnet',
    'claude-sonnet-4.5': 'claude-4.5-sonnet',
    'claude-sonnet-4.6': 'claude-4.6-sonnet-medium',
    'claude-opus-4.7': 'claude-opus-4-7-high',
    'gpt-4.1': 'gpt-5-mini',
    'gpt-5.4': 'gpt-5.4-medium',
    'gpt-5.5': 'gpt-5.5-medium',
    'gemini-2.0-flash': 'gemini-3-flash',
    'gemini-2.0-pro': 'gemini-3.1-pro',
  },
  claude: {
    'claude-haiku-4.5': 'claude-haiku-4-5',
    'claude-sonnet-4.5': 'claude-sonnet-4-5',
    'claude-sonnet-4.6': 'claude-sonnet-4-6',
    'claude-opus-4.5': 'claude-opus-4-5',
    'claude-opus-4.6': 'claude-opus-4-6',
    'claude-opus-4.7': 'claude-opus-4-7',
  },
  gemini: {
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-flash': 'gemini-2.5-flash',
    'gemini-2.0-pro': 'gemini-2.5-pro',
    'gemini-2.0-auto': 'gemini-2.5-pro',
  },
};

export const AGENT_MODEL_CATALOG: Record<AgentBackendId, AgentModelEntry[]> = {
  copilot: [
    { id: 'gpt-4.1', label: 'GPT-4.1', strength: 'Fast, general-purpose coding', tier: 'Standard (included)', multiplier: '0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5-mini', label: 'GPT-5 mini', strength: 'Reliable coding & writing, fast', tier: 'Standard (included)', multiplier: '0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', strength: 'Fast responses, lightweight code', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: ['Dev', 'QA'] },
    { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', strength: 'Fastest Anthropic, simple tasks', tier: 'Standard (included)', multiplier: '~0.25×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', strength: 'Balanced reasoning & code', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', strength: 'Smarter reasoning, reliable completions', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: ['Planning'] },
    { id: 'gpt-5.2', label: 'GPT-5.2', strength: 'General reasoning', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2-Codex', strength: 'Code generation & review', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex', strength: 'Complex engineering, tests, refactors', tier: 'Standard+', multiplier: '~2×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.4', label: 'GPT-5.4', strength: 'Deep reasoning, multi-file tasks', tier: 'Standard+', multiplier: '~2×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.5', label: 'GPT-5.5', strength: 'Complex reasoning & architecture', tier: 'Premium', multiplier: '7.5× (promo)', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', strength: 'Anthropic flagship, deep reasoning', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', strength: 'Improved Opus reasoning', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', strength: 'Most powerful Anthropic model', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
  ],

  'cursor-agent': [
    { id: 'auto', label: 'Auto', strength: 'Cursor picks the best model for the task', tier: 'Varies', multiplier: 'Varies', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'composer-2.5-fast', label: 'Composer 2.5 Fast', strength: 'Fast agentic coding (Cursor default)', tier: 'Included', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', strength: 'General-purpose + reasoning, fast', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: ['Dev', 'QA'] },
    { id: 'gpt-5.4-medium', label: 'GPT-5.4', strength: 'Deep reasoning & multi-file tasks', tier: 'standard', multiplier: 'medium-high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.5-medium', label: 'GPT-5.5', strength: 'Complex reasoning, most powerful GPT', tier: 'premium', multiplier: 'premium usage', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.5-sonnet', label: 'Claude Sonnet 4.5', strength: 'General-purpose, reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.6-sonnet-medium', label: 'Claude Sonnet 4.6', strength: 'General-purpose + deeper reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: ['Planning'] },
    { id: 'claude-opus-4-7-high', label: 'Claude Opus 4.7', strength: "Anthropic's most powerful", tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', strength: 'Fast context processing', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', strength: 'Massive context, advanced reasoning', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
  ],

  claude: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', strength: 'Fast, lightweight tasks', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: ['Dev', 'QA'] },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', strength: 'General-purpose, reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', strength: 'General-purpose + deeper reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: ['Planning'] },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', strength: 'Deep reasoning, complex problems', tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', strength: 'Deep reasoning (fast mode)', tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', strength: "Anthropic's most powerful", tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
  ],

  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', strength: 'Fast, lightweight context', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes', fleetMode: 'No', preferredFor: ['Dev', 'QA'] },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', strength: 'Deep reasoning, high context', tier: 'standard', multiplier: 'medium', yoloMode: 'Yes', fleetMode: 'No', preferredFor: ['Planning'] },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)', strength: 'Fast operations (Gemini 3 family)', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes', fleetMode: 'No', preferredFor: [] },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (preview)', strength: 'Complex reasoning (Gemini 3 family)', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'No', preferredFor: [] },
  ],
};

export const PREFERRED_MODELS_BY_BACKEND: Record<AgentBackendId, SavedModelsTriple> = {
  copilot: { planModel: 'claude-sonnet-4.6', devModel: 'gpt-5.4-mini', qaModel: 'gpt-5.4-mini' },
  'cursor-agent': { planModel: 'claude-4.6-sonnet-medium', devModel: 'gpt-5-mini', qaModel: 'gpt-5-mini' },
  claude: { planModel: 'claude-sonnet-4-6', devModel: 'claude-haiku-4-5', qaModel: 'claude-haiku-4-5' },
  gemini: { planModel: 'gemini-2.5-pro', devModel: 'gemini-2.5-flash', qaModel: 'gemini-2.5-flash' },
};

export function getPreferredModels(backend: AgentBackendId): SavedModelsTriple {
  return PREFERRED_MODELS_BY_BACKEND[backend];
}

export function isModelInCatalog(backend: AgentBackendId, modelId: string): boolean {
  if (!modelId) return false;
  const list = AGENT_MODEL_CATALOG[backend] || [];
  return list.some((m) => m.id === modelId);
}

/** Map legacy settings IDs to current CLI IDs when still recognizable. */
export function normalizeModelId(backend: AgentBackendId, modelId: string): string {
  if (!modelId || isModelInCatalog(backend, modelId)) return modelId;
  const alias = LEGACY_MODEL_ALIASES[backend]?.[modelId];
  if (alias && isModelInCatalog(backend, alias)) return alias;
  return modelId;
}

const ROLE_RECOMMENDATION_LABEL: Record<ModelRole, string> = {
  Planning: 'planning',
  Dev: 'dev',
  QA: 'qa',
};

/** Dropdown label: `(id) Model -- recommended for …` */
export function formatModelOptionLabel(entry: AgentModelEntry, role: ModelRole): string {
  const recommended = entry.preferredFor.includes(role);
  const suffix = recommended ? ` -- recommended for ${ROLE_RECOMMENDATION_LABEL[role]}` : '';
  return `(${entry.id}) ${entry.label}${suffix}`;
}

export function withSavedModelsForBackend(
  saved: SavedModelsByBackend | undefined,
  backend: AgentBackendId,
  triple: SavedModelsTriple,
): SavedModelsByBackend {
  return { ...saved, [backend]: triple };
}

function resolveRoleModel(
  backend: AgentBackendId,
  modelId: string,
  preferredId: string,
): string {
  const normalized = normalizeModelId(backend, modelId);
  return isModelInCatalog(backend, normalized) ? normalized : preferredId;
}

/** Restore saved models for a backend, or preferred defaults when missing/invalid. */
export function resolveModelsForBackend(
  backend: AgentBackendId,
  saved: SavedModelsByBackend | undefined,
): SavedModelsTriple {
  const preferred = getPreferredModels(backend);
  const stored = saved?.[backend];
  if (!stored) return preferred;

  return {
    planModel: resolveRoleModel(backend, stored.planModel, preferred.planModel),
    devModel: resolveRoleModel(backend, stored.devModel, preferred.devModel),
    qaModel: resolveRoleModel(backend, stored.qaModel, preferred.qaModel),
  };
}

/** Normalize active + saved model triples after catalog/CLI ID changes. */
export function normalizeSettingsModels(
  backend: AgentBackendId,
  planModel: string,
  devModel: string,
  qaModel: string,
  savedModelsByBackend: SavedModelsByBackend | undefined,
): {
  planModel: string;
  devModel: string;
  qaModel: string;
  savedModelsByBackend: SavedModelsByBackend;
} {
  const saved = savedModelsByBackend ?? {};
  const normalizedSaved: SavedModelsByBackend = { ...saved };

  for (const key of Object.keys(saved) as AgentBackendId[]) {
    const triple = saved[key];
    if (!triple) continue;
    normalizedSaved[key] = resolveModelsForBackend(key, { [key]: triple });
  }

  return {
    planModel: resolveRoleModel(backend, planModel, getPreferredModels(backend).planModel),
    devModel: resolveRoleModel(backend, devModel, getPreferredModels(backend).devModel),
    qaModel: resolveRoleModel(backend, qaModel, getPreferredModels(backend).qaModel),
    savedModelsByBackend: normalizedSaved,
  };
}
