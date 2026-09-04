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
    expect(getPreferredModels('cursor-agent').planModel).toBe('claude-sonnet-5-thinking-high');
    expect(isModelInCatalog('cursor-agent', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('cursor-agent', 'claude-sonnet-5-thinking-high')).toBe(true);
    const cursorPlan = AGENT_MODEL_CATALOG['cursor-agent'].find(
      (e) => e.id === 'claude-sonnet-5-thinking-high',
    );
    expect(cursorPlan?.preferredFor).toContain('Planning');
  });

  it('claude backend uses hyphenated Claude Code CLI IDs', () => {
    expect(getPreferredModels('claude')).toEqual({
      planModel: 'claude-opus-4-5',
      devModel: 'claude-sonnet-5',
      qaModel: 'claude-sonnet-5',
    });
    expect(isModelInCatalog('claude', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('claude', 'claude-sonnet-4-6')).toBe(true);
    expect(isModelInCatalog('claude', 'claude-sonnet-5')).toBe(true);
  });

  it('copilot keeps dotted Anthropic IDs separate from Claude CLI', () => {
    expect(AGENT_MODEL_CATALOG.copilot.length).toBe(24);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4.6')).toBe(true);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4-6')).toBe(false);
    expect(isModelInCatalog('copilot', 'claude-sonnet-5')).toBe(true);
    expect(getPreferredModels('copilot')).toEqual({
      planModel: 'claude-opus-4.5',
      devModel: 'claude-sonnet-5',
      qaModel: 'claude-sonnet-5',
    });
  });

  it('gemini catalog uses Gemini 3 preview IDs for preferred roles', () => {
    expect(getPreferredModels('gemini')).toEqual({
      planModel: 'gemini-3-pro-preview',
      devModel: 'gemini-3-flash-preview',
      qaModel: 'gemini-3-flash-preview',
    });
    expect(isModelInCatalog('gemini', 'gemini-2.0-flash')).toBe(false);
    expect(isModelInCatalog('gemini', 'gemini-3-flash-preview')).toBe(true);
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
    expect(normalizeModelId('cursor-agent', 'claude-sonnet-4.6')).toBe('claude-sonnet-5-thinking-high');
    expect(normalizeModelId('claude', 'claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    expect(normalizeModelId('gemini', 'gemini-2.0-auto')).toBe('gemini-3-pro-preview');
  });

  it('formatModelOptionLabel uses (id) Model -- recommendation', () => {
    const planEntry = AGENT_MODEL_CATALOG.claude.find((e) => e.id === 'claude-opus-4-5')!;
    expect(formatModelOptionLabel(planEntry, 'Planning')).toBe(
      '(claude-opus-4-5) Claude Opus 4.5 -- recommended for planning',
    );
    const devEntry = AGENT_MODEL_CATALOG.claude.find((e) => e.id === 'claude-sonnet-5')!;
    expect(formatModelOptionLabel(devEntry, 'Dev')).toBe(
      '(claude-sonnet-5) Claude Sonnet 5 -- recommended for dev',
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
      planModel: 'claude-sonnet-5-thinking-high',
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
    expect(result.planModel).toBe('gemini-3-pro-preview');
    expect(result.devModel).toBe('gemini-3-flash-preview');
    expect(result.qaModel).toBe('gemini-3-flash-preview');
  });

  it('normalizeSettingsModels preserves custom free-text model IDs instead of resetting to preferred', () => {
    const result = normalizeSettingsModels(
      'copilot',
      'my-org/custom-fine-tune',
      'gpt-5.4-mini',
      'gpt-5.4-mini',
      {},
    );
    expect(result.planModel).toBe('my-org/custom-fine-tune');
  });

  it('resolveModelsForBackend preserves a saved custom free-text model ID', () => {
    const saved = {
      copilot: { planModel: 'my-org/custom-fine-tune', devModel: 'gpt-5.4-mini', qaModel: 'gpt-5.4-mini' },
    };
    expect(resolveModelsForBackend('copilot', saved).planModel).toBe('my-org/custom-fine-tune');
  });

  it('resolveModelsForBackend falls back to preferred when no saved entry', () => {
    expect(resolveModelsForBackend('gemini', {})).toEqual(getPreferredModels('gemini'));
  });

  it('catalog ids match docs/coding-agents-available-models.md tables', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const md = await readFile(
      path.join(here, '../../docs/coding-agents-available-models.md'),
      'utf-8',
    );
    const sectionToBackend: Record<string, keyof typeof AGENT_MODEL_CATALOG> = {
      'Cursor Agent CLI': 'cursor-agent',
      'Claude Code CLI': 'claude',
      'Gemini CLI': 'gemini',
      'GitHub Copilot CLI': 'copilot',
      'OpenCode CLI': 'opencode',
    };
    for (const [heading, backend] of Object.entries(sectionToBackend)) {
      const start = md.indexOf(`## ${heading}`);
      expect(start).toBeGreaterThanOrEqual(0);
      const rest = md.slice(start);
      const next = rest.indexOf('\n## ', 3);
      const section = next === -1 ? rest : rest.slice(0, next);
      const ids = [...section.matchAll(/^\| [^|]+ \| ([^|]+) \|/gm)]
        .map((m) => m[1].trim())
        .filter((id) => id && id !== 'ID' && !id.startsWith('-'));
      const catalogIds = AGENT_MODEL_CATALOG[backend].map((e) => e.id);
      expect(catalogIds.sort()).toEqual([...ids].sort());
    }
  });
});
