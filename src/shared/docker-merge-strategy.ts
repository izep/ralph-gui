export type DockerMergeStrategy = "work-branch" | "epic-base-per-task";

export const DEFAULT_DOCKER_MERGE_STRATEGY: DockerMergeStrategy = "work-branch";

export function normalizeDockerMergeStrategy(
  value: string | undefined,
): DockerMergeStrategy {
  return value === "epic-base-per-task" ? "epic-base-per-task" : "work-branch";
}

/** Staging branch (`ralph/epic-*`) + loop-end merge into epic base. */
export function usesWorkBranchStaging(settings: {
  dockerMergeStrategy?: DockerMergeStrategy;
  dockerIsolateBranch: boolean;
}): boolean {
  return (
    normalizeDockerMergeStrategy(settings.dockerMergeStrategy) === "work-branch" &&
    settings.dockerIsolateBranch
  );
}

/** Merge each parallel slot (or sequential commits) directly into epic base per task. */
export function mergesPerTaskToEpicBase(settings: {
  dockerMergeStrategy?: DockerMergeStrategy;
}): boolean {
  return normalizeDockerMergeStrategy(settings.dockerMergeStrategy) === "epic-base-per-task";
}

export function isProtectedEpicBaseBranch(branch: string): boolean {
  const normalized = branch.trim().toLowerCase();
  return normalized === "main" || normalized === "master";
}
