import { describe, expect, it } from "vitest";
import {
  isProtectedEpicBaseBranch,
  mergesPerTaskToEpicBase,
  normalizeDockerMergeStrategy,
  usesWorkBranchStaging,
} from "./docker-merge-strategy.js";

describe("docker-merge-strategy", () => {
  it("normalizes unknown values to work-branch", () => {
    expect(normalizeDockerMergeStrategy(undefined)).toBe("work-branch");
    expect(normalizeDockerMergeStrategy("other")).toBe("work-branch");
    expect(normalizeDockerMergeStrategy("epic-base-per-task")).toBe("epic-base-per-task");
  });

  it("detects work branch staging", () => {
    expect(
      usesWorkBranchStaging({ dockerMergeStrategy: "work-branch", dockerIsolateBranch: true }),
    ).toBe(true);
    expect(
      usesWorkBranchStaging({ dockerMergeStrategy: "work-branch", dockerIsolateBranch: false }),
    ).toBe(false);
    expect(
      usesWorkBranchStaging({ dockerMergeStrategy: "epic-base-per-task", dockerIsolateBranch: true }),
    ).toBe(false);
  });

  it("detects per-task epic base merges", () => {
    expect(mergesPerTaskToEpicBase({ dockerMergeStrategy: "epic-base-per-task" })).toBe(true);
    expect(mergesPerTaskToEpicBase({ dockerMergeStrategy: "work-branch" })).toBe(false);
  });

  it("flags main and master as protected", () => {
    expect(isProtectedEpicBaseBranch("main")).toBe(true);
    expect(isProtectedEpicBaseBranch("MASTER")).toBe(true);
    expect(isProtectedEpicBaseBranch("feature/foo")).toBe(false);
  });
});
