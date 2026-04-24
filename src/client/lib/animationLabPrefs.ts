export const UI_ANIMATION_LAB_STORAGE_KEY = "ralph.animationLabUi";

export interface AnimationLabUiPrefs {
  enabled: boolean;
}

export const DEFAULT_ANIMATION_LAB_UI_PREFS: AnimationLabUiPrefs = {
  enabled: false,
};

function parsePrefs(raw: string | null): AnimationLabUiPrefs {
  if (!raw) return { ...DEFAULT_ANIMATION_LAB_UI_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<AnimationLabUiPrefs> & Record<string, unknown>;
    return {
      enabled: Boolean(parsed.enabled),
    };
  } catch {
    return { ...DEFAULT_ANIMATION_LAB_UI_PREFS };
  }
}

export function loadAnimationLabUiPrefs(): AnimationLabUiPrefs {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_ANIMATION_LAB_UI_PREFS };
  }
  return parsePrefs(localStorage.getItem(UI_ANIMATION_LAB_STORAGE_KEY));
}

export function saveAnimationLabUiPrefs(prefs: AnimationLabUiPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(UI_ANIMATION_LAB_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors.
  }
}