// Source of truth: docs/coding-agents-available-models.md
// Shared catalog between client and server. Duplicates AgentBackendId here to avoid circular imports.
// Model IDs must match each CLI's --model / -m flags (verified via cursor-agent models, Claude --help, Gemini CLI).

export type AgentBackendId = 'copilot' | 'cursor-agent' | 'claude' | 'gemini' | 'opencode';

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
  copilot: {
    'gpt-4.1': 'gpt-5.4-mini',
    'gpt-5.2': 'gpt-5.4',
    'gpt-5.2-codex': 'gpt-5.3-codex',
  },
  'cursor-agent': {
    'cursor-small': 'composer-2.5-fast',
    'claude-haiku-4.5': 'claude-4.5-sonnet',
    'claude-sonnet-4.5': 'claude-4.5-sonnet',
    'claude-sonnet-4.6': 'claude-sonnet-5-thinking-high',
    'claude-4.6-sonnet-medium': 'claude-sonnet-5-thinking-high',
    'claude-opus-4.7': 'claude-opus-4-8-thinking-high',
    'claude-opus-4-7-high': 'claude-opus-5-thinking-high',
    'gpt-4.1': 'gpt-5.4-mini-medium',
    'gpt-5.2-codex': 'gpt-5.3-codex',
    'gpt-5.4': 'gpt-5.4-medium',
    'gpt-5.5': 'gpt-5.5-medium',
    'gemini-2.0-flash': 'gemini-3.5-flash',
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
    'gemini-1.5-pro': 'gemini-3-pro-preview',
    'gemini-2.0-flash': 'gemini-3-flash-preview',
    'gemini-2.0-pro': 'gemini-3-pro-preview',
    'gemini-2.0-auto': 'gemini-3-pro-preview',
    'gemini-2.5-flash': 'gemini-3-flash-preview',
    'gemini-2.5-pro': 'gemini-3-pro-preview',
  },
};

export const AGENT_MODEL_CATALOG: Record<AgentBackendId, AgentModelEntry[]> = {
  copilot: [
    { id: 'gpt-5-mini', label: 'GPT-5 mini', strength: 'Reliable coding & writing, fast', tier: 'Standard (included)', multiplier: '0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', strength: 'Fast responses, lightweight code', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: ['Dev', 'QA'] },
    { id: 'mai-code-1-flash-picker', label: 'MAI-Code-1-Flash', strength: 'Fast, lightweight code (Microsoft AI)', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'mai-code-1.1-flash', label: 'MAI-Code-1.1-Flash', strength: 'Fast, lightweight code (Microsoft AI)', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', strength: 'Fastest Anthropic, simple tasks', tier: 'Standard (included)', multiplier: '~0.25×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', strength: 'Fast context processing', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', strength: 'Fast context processing (newer gen)', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', strength: 'Fastest context processing (latest gen)', tier: 'Standard (included)', multiplier: '~0×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', strength: 'Balanced reasoning & code', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', strength: 'Smarter reasoning, reliable completions', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', strength: 'Latest Sonnet, best speed/intelligence mix', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: ['Planning'] },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex', strength: 'Complex engineering, tests, refactors', tier: 'Standard+', multiplier: '~2×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.4', label: 'GPT-5.4', strength: 'Deep reasoning, multi-file tasks', tier: 'Standard+', multiplier: '~2×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', strength: 'Massive context, advanced reasoning', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.5', label: 'GPT-5.5', strength: 'Complex reasoning & architecture', tier: 'Premium', multiplier: '7.5× (promo)', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', strength: 'Latest GPT, deep reasoning & architecture', tier: 'Premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', strength: 'Latest GPT, general-purpose reasoning', tier: 'Premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', strength: 'Latest GPT, fast lightweight reasoning', tier: 'Standard+', multiplier: '~1×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', strength: 'Anthropic flagship, deep reasoning', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', strength: 'Improved Opus reasoning', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', strength: 'Prior-gen most powerful Anthropic model', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.8', label: 'Claude Opus 4.8', strength: 'Prior-gen Anthropic flagship', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-4.8-fast', label: 'Claude Opus 4.8 (fast)', strength: 'Prior-gen Anthropic flagship (fast mode)', tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
    { id: 'claude-opus-5', label: 'Claude Opus 5', strength: "Anthropic's most powerful, complex agentic coding", tier: 'Premium', multiplier: '~5×', yoloMode: 'Yes', fleetMode: 'Yes (`/fleet`)', preferredFor: [] },
  ],

  'cursor-agent': [
    { id: 'auto', label: 'Auto', strength: 'Cursor picks the best model for the task', tier: 'Varies', multiplier: 'Varies', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'composer-2.5-fast', label: 'Composer 2.5 Fast', strength: 'Fast agentic coding (Cursor default)', tier: 'Included', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.4-mini-medium', label: 'GPT-5.4 Mini', strength: 'Fast coding & reasoning', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: ['Dev', 'QA'] },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', strength: 'General-purpose + reasoning, fast', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', strength: 'Complex engineering, tests, refactors', tier: 'standard', multiplier: 'medium-high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.4-medium', label: 'GPT-5.4', strength: 'Deep reasoning & multi-file tasks', tier: 'standard', multiplier: 'medium-high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.5-medium', label: 'GPT-5.5', strength: 'Complex reasoning, most powerful GPT', tier: 'premium', multiplier: 'premium usage', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gpt-5.6-sol-high', label: 'GPT-5.6 Sol', strength: 'Latest GPT, deep reasoning & architecture', tier: 'premium', multiplier: 'premium usage', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.5-sonnet', label: 'Claude Sonnet 4.5', strength: 'General-purpose, reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.5-sonnet-thinking', label: 'Claude Sonnet 4.5 (thinking)', strength: 'Reasoning with extended thinking', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.6-sonnet-medium', label: 'Claude Sonnet 4.6', strength: 'General-purpose + deeper reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-4.6-sonnet-medium-thinking', label: 'Claude Sonnet 4.6 (thinking)', strength: 'Deeper reasoning with extended thinking', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-sonnet-5-thinking-high', label: 'Claude Sonnet 5', strength: 'Latest Sonnet, best speed/intelligence mix', tier: 'standard', multiplier: '1×', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: ['Planning'] },
    { id: 'claude-fable-5-thinking-high', label: 'Claude Fable 5', strength: 'Long-horizon agentic reasoning', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-opus-4-7-high', label: 'Claude Opus 4.7', strength: 'Deep reasoning, complex problems', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-opus-4-7-thinking-xhigh', label: 'Claude Opus 4.7 (thinking)', strength: 'Extended thinking, complex problems', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-opus-4-8-thinking-high', label: 'Claude Opus 4.8', strength: "Anthropic's prior-gen most powerful", tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'claude-opus-5-thinking-high', label: 'Claude Opus 5', strength: "Anthropic's most powerful, complex agentic coding", tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', strength: 'Fast context processing', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', strength: 'Fast context processing (prior gen)', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3.7-flash-high', label: 'Gemini 3.7 Flash', strength: 'Fastest context processing (latest gen)', tier: 'fast/cheap', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', strength: 'Massive context, advanced reasoning', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
    { id: 'cursor-grok-4.6-high', label: 'Cursor Grok 4.6', strength: 'Cursor Models pool flagship, general coding', tier: 'Included', multiplier: 'Included', yoloMode: 'Yes', fleetMode: 'Partial (Composer)', preferredFor: [] },
  ],

  claude: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', strength: 'Fast, lightweight tasks', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: ['Dev', 'QA'] },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', strength: 'General-purpose, reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', strength: 'General-purpose + deeper reasoning', tier: 'standard', multiplier: '1×', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', strength: 'Latest Sonnet, best speed/intelligence mix', tier: 'standard', multiplier: '1×', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: ['Planning'] },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', strength: 'Deep reasoning, complex problems', tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', strength: 'Deep reasoning (fast mode)', tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', strength: 'Prior-gen most powerful', tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
    { id: 'claude-opus-5', label: 'Claude Opus 5', strength: "Anthropic's most powerful, complex agentic coding", tier: 'premium', multiplier: 'high', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Yes', preferredFor: [] },
  ],

  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', strength: 'Fast, lightweight context', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes', fleetMode: 'No', preferredFor: [] },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', strength: 'Deep reasoning, high context', tier: 'standard', multiplier: 'medium', yoloMode: 'Yes', fleetMode: 'No', preferredFor: [] },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)', strength: 'Fast operations (Gemini 3 family)', tier: 'fast/cheap', multiplier: 'low', yoloMode: 'Yes', fleetMode: 'No', preferredFor: ['Dev', 'QA'] },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (preview)', strength: 'Complex reasoning (Gemini 3 family)', tier: 'premium', multiplier: 'high', yoloMode: 'Yes', fleetMode: 'No', preferredFor: ['Planning'] },
  ],

  opencode: [
    { id: 'opencode/big-pickle', label: 'Big Pickle', strength: 'Stealth coding-agent model (GLM-4.6 class)', tier: 'Free', multiplier: 'Free', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Partial (subagents)', preferredFor: ['Dev', 'Planning'] },
    { id: 'opencode/deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', strength: 'Fast DeepSeek V4 Flash, lightweight tasks', tier: 'Free', multiplier: 'Free', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Partial (subagents)', preferredFor: ['Dev', 'QA'] },
    { id: 'opencode/mimo-v2.5-free', label: 'MiMo-V2.5 Free', strength: 'Fast Xiaomi MiMo coding model', tier: 'Free', multiplier: 'Free', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Partial (subagents)', preferredFor: ['Dev', 'QA'] },
    { id: 'opencode/nemotron-3-super-free', label: 'Nemotron 3 Super Free', strength: 'NVIDIA Nemotron 3 Super (trial endpoints)', tier: 'Free', multiplier: 'Free', yoloMode: 'Yes (`--dangerously-skip-permissions`)', fleetMode: 'Partial (subagents)', preferredFor: ['Dev', 'QA'] },
  ],
};

export const PREFERRED_MODELS_BY_BACKEND: Record<AgentBackendId, SavedModelsTriple> = {
  copilot: { planModel: 'claude-sonnet-5', devModel: 'gpt-5.4-mini', qaModel: 'gpt-5.4-mini' },
  'cursor-agent': { planModel: 'claude-sonnet-5-thinking-high', devModel: 'gpt-5.4-mini-medium', qaModel: 'gpt-5.4-mini-medium' },
  claude: { planModel: 'claude-sonnet-5', devModel: 'claude-haiku-4-5', qaModel: 'claude-haiku-4-5' },
  gemini: { planModel: 'gemini-3-pro-preview', devModel: 'gemini-3-flash-preview', qaModel: 'gemini-3-flash-preview' },
  opencode: { planModel: 'opencode/big-pickle', devModel: 'opencode/deepseek-v4-flash-free', qaModel: 'opencode/deepseek-v4-flash-free' },
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
  // No stored value at all: use the recommended default.
  if (!modelId) return preferredId;
  // Otherwise, upgrade retired catalog IDs via legacy aliases when possible, but
  // preserve anything else as-is -- including custom/free-text model IDs typed
  // by the user, which intentionally aren't in AGENT_MODEL_CATALOG.
  return normalizeModelId(backend, modelId);
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
