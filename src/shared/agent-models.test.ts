import { describe, it, expect } from 'vitest';

import {
  AGENT_MODEL_CATALOG,
  PREFERRED_MODELS_BY_BACKEND,
  formatModelOptionLabel,
  getPreferredModels,
  isModelInCatalog,
  normalizeModelId,
  normalizeSettingsModels,
  resolveModelsForBackend,
} from './agent-models';

describe('agent-models catalog', () => {
  it('preferred models exist in the catalog for each backend', () => {
    for (const backend of Object.keys(PREFERRED_MODELS_BY_BACKEND) as Array<
      keyof typeof PREFERRED_MODELS_BY_BACKEND
    >) {
      const pref = PREFERRED_MODELS_BY_BACKEND[backend];
      expect(isModelInCatalog(backend, pref.planModel)).toBe(true);
      expect(isModelInCatalog(backend, pref.devModel)).toBe(true);
      expect(isModelInCatalog(backend, pref.qaModel)).toBe(true);
    }
  });

  it('cursor-agent uses cursor-agent CLI model IDs', () => {
    expect(getPreferredModels('cursor-agent').planModel).toBe('claude-4.6-sonnet-medium');
    expect(isModelInCatalog('cursor-agent', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('cursor-agent', 'claude-4.6-sonnet-medium')).toBe(true);
    const cursorPlan = AGENT_MODEL_CATALOG['cursor-agent'].find(
      (e) => e.id === 'claude-4.6-sonnet-medium',
    );
    expect(cursorPlan?.preferredFor).toContain('Planning');
  });

  it('claude backend uses hyphenated Claude Code CLI IDs', () => {
    expect(getPreferredModels('claude').planModel).toBe('claude-sonnet-4-6');
    expect(isModelInCatalog('claude', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('claude', 'claude-sonnet-4-6')).toBe(true);
  });

  it('copilot keeps dotted Anthropic IDs separate from Claude CLI', () => {
    expect(AGENT_MODEL_CATALOG.copilot.length).toBe(14);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4.6')).toBe(true);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4-6')).toBe(false);
    expect(getPreferredModels('copilot').planModel).toBe('claude-sonnet-4.6');
  });

  it('gemini catalog uses Gemini 2.5+ IDs', () => {
    expect(getPreferredModels('gemini')).toEqual({
      planModel: 'gemini-2.5-pro',
      devModel: 'gemini-2.5-flash',
      qaModel: 'gemini-2.5-flash',
    });
    expect(isModelInCatalog('gemini', 'gemini-2.0-flash')).toBe(false);
    expect(isModelInCatalog('gemini', 'gemini-2.5-flash')).toBe(true);
  });

  it('opencode catalog uses OpenCode Zen free model IDs', () => {
    expect(getPreferredModels('opencode')).toEqual({
      planModel: 'opencode/big-pickle',
      devModel: 'opencode/deepseek-v4-flash-free',
      qaModel: 'opencode/deepseek-v4-flash-free',
    });
    expect(isModelInCatalog('opencode', 'opencode/big-pickle')).toBe(true);
    expect(isModelInCatalog('opencode', 'openai/gpt-5-mini')).toBe(false);
  });

  it('normalizeModelId maps legacy IDs to current catalog entries', () => {
    expect(normalizeModelId('cursor-agent', 'claude-sonnet-4.6')).toBe('claude-4.6-sonnet-medium');
    expect(normalizeModelId('claude', 'claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    expect(normalizeModelId('gemini', 'gemini-2.0-auto')).toBe('gemini-2.5-pro');
  });

  it('formatModelOptionLabel uses (id) Model -- recommendation', () => {
    const entry = AGENT_MODEL_CATALOG.claude.find((e) => e.id === 'claude-sonnet-4-6')!;
    expect(formatModelOptionLabel(entry, 'Planning')).toBe(
      '(claude-sonnet-4-6) Claude Sonnet 4.6 -- recommended for planning',
    );
  });

  it('resolveModelsForBackend restores saved triple when switching back', () => {
    const saved = {
      copilot: { planModel: 'claude-sonnet-4.6', devModel: 'gpt-5.4-mini', qaModel: 'gpt-5.4-mini' },
    };
    const resolved = resolveModelsForBackend('copilot', saved);
    expect(resolved).toEqual(saved.copilot);
  });

  it('resolveModelsForBackend upgrades legacy cursor-agent saved models', () => {
    const saved = {
      'cursor-agent': {
        planModel: 'claude-sonnet-4.6',
        devModel: 'gpt-5-mini',
        qaModel: 'gpt-5-mini',
      },
    };
    expect(resolveModelsForBackend('cursor-agent', saved)).toEqual({
      planModel: 'claude-4.6-sonnet-medium',
      devModel: 'gpt-5-mini',
      qaModel: 'gpt-5-mini',
    });
  });

  it('normalizeSettingsModels fixes active models for current backend', () => {
    const result = normalizeSettingsModels(
      'gemini',
      'gemini-2.0-auto',
      'gemini-2.0-flash',
      'gemini-2.0-flash',
      {},
    );
    expect(result.planModel).toBe('gemini-2.5-pro');
    expect(result.devModel).toBe('gemini-2.5-flash');
    expect(result.qaModel).toBe('gemini-2.5-flash');
  });

  it('resolveModelsForBackend falls back to preferred when no saved entry', () => {
    expect(resolveModelsForBackend('gemini', {})).toEqual(getPreferredModels('gemini'));
  });
});
