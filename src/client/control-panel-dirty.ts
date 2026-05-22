import type { Settings } from "./types";

const DOCKER_KEYS: ReadonlyArray<keyof Settings> = [
  "useDocker",
  "dockerComposeFile",
  "dockerService",
  "dockerIsolateBranch",
  "dockerPoolSize",
  "dockerParallelTasks",
  "dockerMountSocket",
  "dockerInstalledBackends",
  "dockerPlanParallel",
];

export function pickDockerSettings(s: Settings): Partial<Settings> {
  const result: Partial<Settings> = {};
  for (const key of DOCKER_KEYS) {
    (result as Record<string, unknown>)[key] = s[key];
  }
  return result;
}

export function pickLoopSettings(s: Settings): Partial<Settings> {
  const result: Partial<Settings> = {};
  for (const key of Object.keys(s) as Array<keyof Settings>) {
    if (!(DOCKER_KEYS as ReadonlyArray<string>).includes(key)) {
      (result as Record<string, unknown>)[key] = s[key];
    }
  }
  return result;
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + (obj as unknown[]).map(stableStringify).join(",") + "]";
  const record = obj as Record<string, unknown>;
  const sorted = Object.keys(record).sort();
  return "{" + sorted.map((k) => JSON.stringify(k) + ":" + stableStringify(record[k])).join(",") + "}";
}

export function isDockerDirty(local: Settings, saved: Settings): boolean {
  return stableStringify(pickDockerSettings(local)) !== stableStringify(pickDockerSettings(saved));
}

export function isLoopDirty(local: Settings, saved: Settings): boolean {
  return stableStringify(pickLoopSettings(local)) !== stableStringify(pickLoopSettings(saved));
}
