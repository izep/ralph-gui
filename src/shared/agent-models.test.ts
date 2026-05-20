import { describe, it, expect } from 'vitest';

import {
  AGENT_MODEL_CATALOG,
  PREFERRED_MODELS_BY_BACKEND,
  isModelInCatalog,
  getPreferredModels,
} from './agent-models';

describe('agent-models catalog', () => {
  it('preferred models exist in the catalog for each backend', () => {
    for (const backend of Object.keys(PREFERRED_MODELS_BY_BACKEND) as Array<keyof typeof PREFERRED_MODELS_BY_BACKEND>) {
      const pref = PREFERRED_MODELS_BY_BACKEND[backend as any];
      expect(isModelInCatalog(backend as any, pref.plan)).toBe(true);
      expect(isModelInCatalog(backend as any, pref.dev)).toBe(true);
      expect(isModelInCatalog(backend as any, pref.qa)).toBe(true);
    }
  });

  it('isModelInCatalog returns true/false as expected', () => {
    expect(isModelInCatalog('copilot', 'gpt-5.4')).toBe(true);
    expect(isModelInCatalog('copilot', 'nonexistent-model')).toBe(false);
  });

  it('getPreferredModels returns the mapping for a backend', () => {
    const pm = getPreferredModels('copilot');
    expect(pm).toHaveProperty('plan');
    expect(pm).toHaveProperty('dev');
    expect(pm).toHaveProperty('qa');
    expect(isModelInCatalog('copilot', pm.plan)).toBe(true);
  });
});
