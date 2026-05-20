// Source of truth: docs/coding-agents-available-models.md
// Shared catalog between client and server. Duplicates AgentBackendId here to avoid circular imports.

export type AgentBackendId = 'copilot' | 'cursor-agent' | 'claude' | 'gemini';

export interface AgentModelEntry {
  id: string;           // CLI model ID
  label: string;        // Human display name
  strength: string;
  tier: string;
  multiplier: string;
  yoloMode: string;
  fleetMode: string;
  preferredFor: string[]; // e.g. ['Planning'] | ['Dev','QA'] | []
}

export const AGENT_MODEL_CATALOG: Record<AgentBackendId, AgentModelEntry[]> = {
  'copilot': [
    { id: 'gpt-4.1', label: 'gpt-4.1', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5-mini', label: 'gpt-5-mini', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5.2', label: 'gpt-5.2', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5.2-codex', label: 'gpt-5.2-codex', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5.3-codex', label: 'gpt-5.3-codex', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5.4', label: 'gpt-5.4', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Planning'] },
    { id: 'gpt-5.4-mini', label: 'gpt-5.4-mini', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'gpt-5.5', label: 'gpt-5.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
  ],

  'cursor-agent': [
    { id: 'cursor-small', label: 'cursor-small', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'claude-haiku-4.5', label: 'claude-haiku-4.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'claude-sonnet-4.5', label: 'claude-sonnet-4.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'claude-sonnet-4.6', label: 'claude-sonnet-4.6', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Planning'] },
    { id: 'claude-opus-4.7', label: 'claude-opus-4.7', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-4.1', label: 'gpt-4.1', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5-mini', label: 'gpt-5-mini', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'gpt-5.4', label: 'gpt-5.4', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gpt-5.5', label: 'gpt-5.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'gemini-2.0-pro', label: 'gemini-2.0-pro', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
  ],

  'claude': [
    { id: 'claude-haiku-4.5', label: 'claude-haiku-4.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'claude-sonnet-4.5', label: 'claude-sonnet-4.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'claude-sonnet-4.6', label: 'claude-sonnet-4.6', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Planning'] },
    { id: 'claude-opus-4.5', label: 'claude-opus-4.5', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'claude-opus-4.6', label: 'claude-opus-4.6', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'claude-opus-4.7', label: 'claude-opus-4.7', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
  ],

  'gemini': [
    { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Dev', 'QA'] },
    { id: 'gemini-2.0-pro', label: 'gemini-2.0-pro', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: [] },
    { id: 'gemini-2.0-auto', label: 'gemini-2.0-auto', strength: '', tier: '', multiplier: '', yoloMode: '', fleetMode: '', preferredFor: ['Planning'] },
  ],
};

export const PREFERRED_MODELS_BY_BACKEND: Record<AgentBackendId, { plan: string; dev: string; qa: string }> = {
  'copilot': { plan: 'gpt-5.4', dev: 'gpt-5.4-mini', qa: 'gpt-5.4-mini' },
  'cursor-agent': { plan: 'claude-sonnet-4.6', dev: 'gpt-5-mini', qa: 'gpt-5-mini' },
  'claude': { plan: 'claude-sonnet-4.6', dev: 'claude-haiku-4.5', qa: 'claude-haiku-4.5' },
  'gemini': { plan: 'gemini-2.0-auto', dev: 'gemini-2.0-flash', qa: 'gemini-2.0-flash' },
};

export function getPreferredModels(backend: AgentBackendId): { plan: string; dev: string; qa: string } {
  return PREFERRED_MODELS_BY_BACKEND[backend];
}

export function isModelInCatalog(backend: AgentBackendId, modelId: string): boolean {
  const list = AGENT_MODEL_CATALOG[backend] || [];
  return list.some(m => m.id === modelId);
}
