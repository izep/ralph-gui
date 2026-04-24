import { useCallback, useState } from "react";
import {
  type AnimationLabUiPrefs,
  loadAnimationLabUiPrefs,
  saveAnimationLabUiPrefs,
} from "../lib/animationLabPrefs";

export function useAnimationLabPrefs(): [AnimationLabUiPrefs, (next: AnimationLabUiPrefs) => void] {
  const [prefs, setPrefsState] = useState<AnimationLabUiPrefs>(() => loadAnimationLabUiPrefs());

  const setPrefs = useCallback((next: AnimationLabUiPrefs) => {
    setPrefsState(next);
    saveAnimationLabUiPrefs(next);
  }, []);

  return [prefs, setPrefs];
}