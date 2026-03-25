import { describe, it, expect } from "vitest";
import { groupTasks } from "./types";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> & { id: number }): Task {
  return {
    title: `Task ${overrides.id}`,
    description: "",
    status: "backlog",
    devIterations: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupTasks", () => {
  it("groups tasks by status", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, status: "backlog" }),
      makeTask({ id: 2, status: "inProgress" }),
      makeTask({ id: 3, status: "inQa" }),
      makeTask({ id: 4, status: "done" }),
    ];

    const groups = groupTasks(tasks);
    expect(groups["backlog"]).toHaveLength(1);
    expect(groups.inProgress).toHaveLength(1);
    expect(groups.inQa).toHaveLength(1);
    expect(groups["done"]).toHaveLength(1);
  });

  it("places blocked tasks into the inProgress column", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, status: "blocked" }),
      makeTask({ id: 2, status: "inProgress" }),
    ];

    const groups = groupTasks(tasks);
    expect(groups.inProgress).toHaveLength(2);
    expect(groups["blocked"]).toHaveLength(0);
  });

  it("returns empty arrays when no tasks are provided", () => {
    const groups = groupTasks([]);
    expect(groups["backlog"]).toEqual([]);
    expect(groups.inProgress).toEqual([]);
    expect(groups.inQa).toEqual([]);
    expect(groups["done"]).toEqual([]);
    expect(groups["blocked"]).toEqual([]);
  });

  it("handles multiple tasks in the same status", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, status: "done" }),
      makeTask({ id: 2, status: "done" }),
      makeTask({ id: 3, status: "done" }),
    ];

    const groups = groupTasks(tasks);
    expect(groups["done"]).toHaveLength(3);
  });
});
