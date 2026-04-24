import type { Task, TaskStatusValue } from "../types";

/** Client-only; kept out of server payloads by filtering the merged list. */
export const ANIMATION_LAB_TASK_ID = 9_000_001;

const BOARD_PHASES: TaskStatusValue[] = ["backlog", "inProgress", "inQa", "done"];

export function nextBoardPhaseForLab(status: TaskStatusValue): TaskStatusValue {
  const index = BOARD_PHASES.indexOf(status);
  if (index < 0) return "backlog";
  return BOARD_PHASES[(index + 1) % BOARD_PHASES.length]!;
}

export function makeAnimationLabTask(status: TaskStatusValue): Task {
  const now = new Date().toISOString();
  return {
    id: ANIMATION_LAB_TASK_ID,
    title: "Lane-to-lane animation (click this card)",
    description:
      "This card only exists in the UI to test motion between columns. Each click moves it: Backlog → In Progress → In QA → Done → back to Backlog. Same path as a real task changing status.",
    status,
    devIterations: 0,
    createdAt: now,
    updatedAt: now,
  };
}