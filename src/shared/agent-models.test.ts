import { describe, it, expect } from 'vitest';

import {
  AGENT_MODEL_CATALOG,
  LEGACY_MODEL_ALIASES,
  MODEL_CATALOG_VERIFIED_AT,
  PREFERRED_MODELS_BY_BACKEND,
  formatModelOptionLabel,
  getPreferredModels,
  getReasoningEfforts,
  isModelInCatalog,
  normalizeModelId,
  normalizeReasoningEffort,
  resolveReasoningEffort,
  normalizeSettingsModels,
  resolveModelsForBackend,
} from './agent-models';

describe('agent-models catalog', () => {
  it('only offers reasoning effort flags for supported backends', () => {
    expect(getReasoningEfforts('copilot')).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
    expect(getReasoningEfforts('claude')).toContain('max');
    for (const backend of ['cursor-agent', 'gemini', 'opencode'] as const) {
      expect(getReasoningEfforts(backend)).toEqual([]);
    }
  });

  it('uses the Copilot catalog reasoning capabilities for each model', () => {
    expect(getReasoningEfforts('copilot', 'mai-code-1.1-flash')).toEqual(['low', 'medium', 'high']);
    expect(getReasoningEfforts('copilot', 'claude-haiku-4.5')).toEqual([]);
    expect(getReasoningEfforts('copilot', 'auto')).toEqual([]);
    expect(getReasoningEfforts('copilot', 'gpt-6-luna')).toContain('none');
    expect(getReasoningEfforts('copilot', 'custom/model')).toContain('max');
  });

  it('omits unsupported effort values instead of sending invalid CLI flags', () => {
    expect(resolveReasoningEffort('copilot', 'mai-code-1.1-flash', 'xhigh')).toBeUndefined();
    expect(resolveReasoningEffort('copilot', 'mai-code-1.1-flash', 'high')).toBe('high');
    expect(resolveReasoningEffort('copilot', 'claude-haiku-4.5', 'high')).toBeUndefined();
    expect(resolveReasoningEffort('cursor-agent', 'gpt-5.4-mini-medium', 'high')).toBeUndefined();
    expect(normalizeReasoningEffort('max')).toBe('max');
    expect(normalizeReasoningEffort('invalid')).toBe('');
  });

  it('has unique model IDs and valid migration targets for every backend', () => {
    for (const backend of Object.keys(AGENT_MODEL_CATALOG) as Array<keyof typeof AGENT_MODEL_CATALOG>) {
      const ids = AGENT_MODEL_CATALOG[backend].map((model) => model.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const target of Object.values(LEGACY_MODEL_ALIASES[backend] ?? {})) {
        expect(ids, `${backend}: ${target}`).toContain(target);
      }
    }
  });

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
    expect(getPreferredModels('cursor-agent').planModel).toBe('claude-sonnet-5-5-high');
    expect(isModelInCatalog('cursor-agent', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('cursor-agent', 'claude-sonnet-5-5-high')).toBe(true);
    const cursorPlan = AGENT_MODEL_CATALOG['cursor-agent'].find(
      (e) => e.id === 'claude-sonnet-5-5-high',
    );
    expect(cursorPlan?.preferredFor).toContain('Planning');
  });

  it('keeps Cursor choices curated while preserving unlisted models as custom IDs', () => {
    expect(AGENT_MODEL_CATALOG['cursor-agent'].length).toBeLessThanOrEqual(20);
    for (const id of ['gpt-5.2', 'claude-4.6-sonnet-medium', 'claude-opus-4-7-high', 'gpt-5.6-sol-low-fast']) {
      expect(isModelInCatalog('cursor-agent', id)).toBe(false);
      expect(normalizeModelId('cursor-agent', id)).toBe(id);
    }
    const saved = {
      planModel: 'claude-opus-4-7-high',
      devModel: 'gpt-5.2',
      qaModel: 'claude-4.6-sonnet-medium',
    };
    expect(resolveModelsForBackend('cursor-agent', { 'cursor-agent': saved })).toEqual(saved);
  });

  it('claude backend uses hyphenated Claude Code CLI IDs', () => {
    expect(getPreferredModels('claude')).toEqual({
      planModel: 'claude-opus-5-5',
      devModel: 'claude-sonnet-5-5',
      qaModel: 'claude-sonnet-5-5',
    });
    expect(isModelInCatalog('claude', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('claude', 'claude-sonnet-4-6')).toBe(true);
    expect(isModelInCatalog('claude', 'claude-sonnet-5')).toBe(true);
  });

  it('copilot keeps dotted Anthropic IDs separate from Claude CLI', () => {
    expect(AGENT_MODEL_CATALOG.copilot.length).toBe(19);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4.6')).toBe(false);
    expect(isModelInCatalog('copilot', 'claude-sonnet-4-6')).toBe(false);
    expect(isModelInCatalog('copilot', 'claude-sonnet-5')).toBe(true);
    expect(isModelInCatalog('copilot', 'gpt-6-astra')).toBe(true);
    expect(isModelInCatalog('copilot', 'claude-fable-5.1')).toBe(true);
    expect(isModelInCatalog('copilot', 'gpt-6.1-sol')).toBe(true);
    expect(isModelInCatalog('copilot', 'claude-sonnet-5.5')).toBe(true);
    expect(isModelInCatalog('copilot', 'claude-opus-4.5')).toBe(false);
    expect(getPreferredModels('copilot')).toEqual({
      planModel: 'claude-opus-5.5',
      devModel: 'claude-sonnet-5.5',
      qaModel: 'claude-sonnet-5.5',
    });
  });

  it('gemini catalog uses Gemini 3 preview IDs for preferred roles', () => {
    expect(getPreferredModels('gemini')).toEqual({
      planModel: 'gemini-3.1-pro-preview',
      devModel: 'gemini-3.5-flash',
      qaModel: 'gemini-3.5-flash',
    });
    expect(isModelInCatalog('gemini', 'gemini-2.0-flash')).toBe(false);
    expect(isModelInCatalog('gemini', 'gemini-3-flash-preview')).toBe(true);
  });

  it('opencode catalog uses OpenCode Zen free model IDs', () => {
    expect(getPreferredModels('opencode')).toEqual({
      planModel: 'opencode/big-pickle',
      devModel: 'opencode/deepseek-v4.1-flash-free',
      qaModel: 'opencode/deepseek-v4.1-flash-free',
    });
    expect(isModelInCatalog('opencode', 'opencode/big-pickle')).toBe(true);
    expect(isModelInCatalog('opencode', 'openai/gpt-5-mini')).toBe(false);
  });

  it('normalizeModelId maps legacy IDs to current catalog entries', () => {
    expect(normalizeModelId('cursor-agent', 'claude-sonnet-4.6')).toBe('claude-sonnet-5-5-high');
    expect(normalizeModelId('claude', 'claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    expect(normalizeModelId('gemini', 'gemini-2.0-auto')).toBe('gemini-3-pro-preview');
    expect(normalizeModelId('copilot', 'claude-opus-4.5')).toBe('claude-opus-5');
    expect(normalizeModelId('copilot', 'mai-code-1-flash-picker')).toBe('mai-code-1.1-flash');
  });

  it('formatModelOptionLabel uses (id) Model -- recommendation', () => {
    const planEntry = AGENT_MODEL_CATALOG.claude.find((e) => e.id === 'claude-opus-5-5')!;
    expect(formatModelOptionLabel(planEntry, 'Planning')).toBe(
      '(claude-opus-5-5) Claude Opus 5.5 -- recommended for planning',
    );
    const devEntry = AGENT_MODEL_CATALOG.claude.find((e) => e.id === 'claude-sonnet-5-5')!;
    expect(formatModelOptionLabel(devEntry, 'Dev')).toBe(
      '(claude-sonnet-5-5) Claude Sonnet 5.5 -- recommended for dev',
    );
  });

  it('resolveModelsForBackend restores saved triple when switching back', () => {
    const saved = {
      copilot: { planModel: 'claude-sonnet-5', devModel: 'gpt-6-luna', qaModel: 'gpt-6-luna' },
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
      planModel: 'claude-sonnet-5-5-high',
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

  it('catalog IDs and metadata match docs/coding-agents-available-models.md tables', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const md = await readFile(
      path.join(here, '../../docs/coding-agents-available-models.md'),
      'utf-8',
    );
    expect(md).toContain(`Verified on **${MODEL_CATALOG_VERIFIED_AT}**`);
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
      const rows = section.split('\n')
        .filter((line) => line.startsWith('| '))
        .slice(2)
        .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/&#124;/g, '|')));
      for (const entry of AGENT_MODEL_CATALOG[backend]) {
        const row = rows.find((cells) => cells[1] === entry.id);
        expect(row?.slice(0, 8)).toEqual([
          entry.label, entry.id, entry.strength, entry.tier, entry.multiplier,
          entry.yoloMode, entry.fleetMode, entry.preferredFor.join(', '),
        ]);
        if (entry.reasoningEfforts) expect(row?.[8]).toBe(entry.reasoningEfforts.join(', '));
      }
    }
  });
});
