import {
  AGENT_MODEL_CATALOG as VERIFIED_AGENT_MODEL_CATALOG,
  PREFERRED_MODELS_BY_BACKEND as VERIFIED_PREFERRED_MODELS,
} from './agent-model-catalog.js';

export const AGENT_BACKENDS = ['copilot', 'cursor-agent', 'claude', 'gemini', 'opencode'] as const;
export type AgentBackendId = (typeof AGENT_BACKENDS)[number];
export const MODEL_CATALOG_VERIFIED_AT = '2026-11-05';

export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function normalizeReasoningEffort(value: string | undefined): ReasoningEffort | '' {
  return REASONING_EFFORTS.find((effort) => effort === value) ?? '';
}

export function resolveReasoningEffort(
  backend: AgentBackendId,
  modelId: string,
  requested: string | undefined,
): ReasoningEffort | undefined {
  return getReasoningEfforts(backend, modelId).find((effort) => effort === requested);
}

export function getReasoningEfforts(backend: AgentBackendId, modelId?: string): readonly ReasoningEffort[] {
  if (backend === 'copilot') {
    const entry = AGENT_MODEL_CATALOG.copilot.find((model) => model.id === modelId);
    return entry?.reasoningEfforts ?? REASONING_EFFORTS;
  }
  if (backend === 'claude') return ['low', 'medium', 'high', 'xhigh', 'max'];
  return [];
}

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
  reasoningEfforts?: ReasoningEffort[];
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
    'gpt-4.1': 'gpt-6-luna',
    'gpt-5-mini': 'gpt-6-luna',
    'gpt-5.4-mini': 'gpt-6-luna',
    'gpt-5.2': 'gpt-5.6-terra',
    'gpt-5.4': 'gpt-5.6-terra',
    'gpt-5.5': 'gpt-6.1-sol',
    'gpt-5.2-codex': 'gpt-5.3-codex',
    'claude-opus-4.5': 'claude-opus-5',
    'claude-opus-4.6': 'claude-opus-5',
    'claude-sonnet-4.5': 'claude-sonnet-5',
    'claude-sonnet-4.6': 'claude-sonnet-5.5',
    'claude-opus-4.7': 'claude-opus-5.5',
    'gemini-3.1-pro-preview': 'auto',
    'gemini-3.5-flash': 'auto',
    'gemini-3.6-flash': 'auto',
    'gemini-3.7-flash': 'auto',
    'gemini-3.8-flash': 'auto',
    'grok-4.5': 'auto',
    'grok-4.6': 'auto',
    'kimi-k2.7-code': 'auto',
    'kimi-k3': 'auto',
    'claude-fable-5': 'claude-fable-5.1',
    'mai-code-1-flash-picker': 'mai-code-1.1-flash',
  },
  'cursor-agent': {
    'cursor-small': 'composer-2.5-fast',
    'claude-haiku-4.5': 'claude-haiku-5-5-thinking-high',
    'claude-sonnet-4.5': 'claude-sonnet-5-5-high',
    'claude-sonnet-4.6': 'claude-sonnet-5-5-high',
    'claude-opus-4.7': 'claude-opus-5-5-high',
    'gpt-4.1': 'gpt-5.4-mini-medium',
    'gpt-5.2-codex': 'gpt-5.3-codex',
    'gpt-5.4': 'gpt-5.6-terra-high',
    'gpt-5.5': 'gpt-5.6-terra-high',
    'gemini-2.0-flash': 'gemini-3.8-flash-high',
    'gemini-2.0-pro': 'gemini-4-argon-high',
  },
  claude: {
    'claude-haiku-4.5': 'claude-haiku-4-5',
    'claude-haiku-5.5': 'claude-haiku-5-5',
    'claude-sonnet-4.5': 'claude-sonnet-4-5',
    'claude-sonnet-4.6': 'claude-sonnet-4-6',
    'claude-sonnet-5.5': 'claude-sonnet-5-5',
    'claude-opus-4.5': 'claude-opus-4-5',
    'claude-opus-4.6': 'claude-opus-4-6',
    'claude-opus-4.7': 'claude-opus-4-7',
    'claude-opus-4.8': 'claude-opus-4-8',
    'claude-opus-5.5': 'claude-opus-5-5',
    'claude-fable-5.1': 'claude-fable-5-1',
    'claude-mythos-5.1': 'claude-mythos-5-1',
  },
  gemini: {
    'gemini-1.5-pro': 'gemini-3-pro-preview',
    'gemini-2.0-flash': 'gemini-3-flash-preview',
    'gemini-2.0-pro': 'gemini-3-pro-preview',
    'gemini-2.0-auto': 'gemini-3-pro-preview',
    'gemini-2.5-flash': 'gemini-3-flash-preview',
    'gemini-2.5-pro': 'gemini-3-pro-preview',
  },
  opencode: {
    'opencode/deepseek-v4-flash-free': 'opencode/deepseek-v4.1-flash-free',
    'opencode/mimo-v2.5-free': 'opencode/mimo-v2.6-flash-free',
    'opencode/nemotron-3-super-free': 'opencode/nemotron-3.5-super-vl-free',
  },
};

export const AGENT_MODEL_CATALOG = VERIFIED_AGENT_MODEL_CATALOG;
export const PREFERRED_MODELS_BY_BACKEND = VERIFIED_PREFERRED_MODELS;

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
