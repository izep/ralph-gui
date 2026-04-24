import { describe, expect, it } from "vitest";
import { ANIMATION_LAB_TASK_ID, makeAnimationLabTask, nextBoardPhaseForLab } from "./animationLab";

describe("animationLab", () => {
  it("cycles board phases in order", () => {
    expect(nextBoardPhaseForLab("backlog")).toBe("inProgress");
    expect(nextBoardPhaseForLab("inProgress")).toBe("inQa");
    expect(nextBoardPhaseForLab("inQa")).toBe("done");
    expect(nextBoardPhaseForLab("done")).toBe("backlog");
  });

  it("creates the client-only animation lab task", () => {
    const task = makeAnimationLabTask("backlog");
    expect(task.id).toBe(ANIMATION_LAB_TASK_ID);
    expect(task.title).toMatch(/Lane-to-lane animation/);
    expect(task.status).toBe("backlog");
  });
});