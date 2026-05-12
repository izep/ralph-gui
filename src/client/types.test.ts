import { describe, it, expect } from "vitest";
import { groupTasks, sortTasks } from "./types";
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

describe("sortTasks", () => {
  it("does not mutate the input array", () => {
    const tasks: Task[] = [
      makeTask({ id: 2, updatedAt: "2026-01-02T00:00:00Z" }),
      makeTask({ id: 1, updatedAt: "2026-01-01T00:00:00Z" }),
    ];
    const snapshot = [...tasks];

    sortTasks(tasks, "idAsc");

    expect(tasks).toEqual(snapshot);
    expect(tasks.map((t) => t.id)).toEqual([2, 1]);
  });

  it("sorts by updatedAt ascending (oldest first), tie-breaks by id", () => {
    const tasks: Task[] = [
      makeTask({ id: 2, updatedAt: "2026-01-03T00:00:00Z" }),
      makeTask({ id: 1, updatedAt: "2026-01-01T00:00:00Z" }),
      makeTask({ id: 3, updatedAt: "2026-01-02T00:00:00Z" }),
    ];
    const out = sortTasks(tasks, "updatedAtAsc");
    expect(out.map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it("sorts by updatedAt descending (newest first), tie-breaks by id", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, updatedAt: "2026-01-01T00:00:00Z" }),
      makeTask({ id: 3, updatedAt: "2026-01-02T00:00:00Z" }),
      makeTask({ id: 2, updatedAt: "2026-01-02T00:00:00Z" }),
    ];
    const out = sortTasks(tasks, "updatedAtDesc");
    expect(out.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it("sorts by id ascending", () => {
    const tasks: Task[] = [
      makeTask({ id: 10, updatedAt: "2026-01-05T00:00:00Z" }),
      makeTask({ id: 2, updatedAt: "2026-01-01T00:00:00Z" }),
      makeTask({ id: 7, updatedAt: "2026-01-03T00:00:00Z" }),
    ];
    expect(sortTasks(tasks, "idAsc").map((t) => t.id)).toEqual([2, 7, 10]);
  });

  it("sorts by id descending", () => {
    const tasks: Task[] = [
      makeTask({ id: 2, updatedAt: "2026-01-01T00:00:00Z" }),
      makeTask({ id: 10, updatedAt: "2026-01-05T00:00:00Z" }),
      makeTask({ id: 7, updatedAt: "2026-01-03T00:00:00Z" }),
    ];
    expect(sortTasks(tasks, "idDesc").map((t) => t.id)).toEqual([10, 7, 2]);
  });

  it("returns a new empty array pattern for empty input", () => {
    expect(sortTasks([], "idAsc")).toEqual([]);
  });
});
