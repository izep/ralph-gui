import { describe, it, expect } from "vitest";
import { groupTasks, sortTasks, sortTasksForColumn, formatInFlightHeader, inFlightTasks } from "./types";
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

  it("keeps mixed columns including two in-progress and a blocked card visible", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, status: "backlog" }),
      makeTask({ id: 2, status: "inProgress" }),
      makeTask({ id: 3, status: "inProgress" }),
      makeTask({ id: 4, status: "inQa" }),
      makeTask({ id: 5, status: "done" }),
      makeTask({ id: 6, status: "blocked" }),
    ];
    const groups = groupTasks(tasks);
    expect(groups.backlog.map((t) => t.id)).toEqual([1]);
    expect(groups.inProgress.map((t) => t.id)).toEqual([2, 3, 6]);
    expect(groups.inQa.map((t) => t.id)).toEqual([4]);
    expect(groups.done.map((t) => t.id)).toEqual([5]);
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

describe("sortTasksForColumn", () => {
  const mixed: Task[] = [
    makeTask({ id: 10, updatedAt: "2026-01-05T00:00:00Z" }),
    makeTask({ id: 2, updatedAt: "2026-01-01T00:00:00Z" }),
    makeTask({ id: 7, updatedAt: "2026-01-03T00:00:00Z" }),
  ];

  it("always sorts backlog by task id ascending", () => {
    expect(sortTasksForColumn("backlog", mixed, "updatedAtDesc").map((t) => t.id)).toEqual([
      2, 7, 10,
    ]);
    expect(sortTasksForColumn("backlog", mixed, "idDesc").map((t) => t.id)).toEqual([
      2, 7, 10,
    ]);
  });

  it("uses the project setting for inProgress, inQa, and done", () => {
    expect(sortTasksForColumn("inProgress", mixed, "updatedAtDesc").map((t) => t.id)).toEqual([
      10, 7, 2,
    ]);
    expect(sortTasksForColumn("inQa", mixed, "idDesc").map((t) => t.id)).toEqual([10, 7, 2]);
    expect(sortTasksForColumn("done", mixed, "updatedAtAsc").map((t) => t.id)).toEqual([
      2, 7, 10,
    ]);
  });
});

describe("inFlightTasks / formatInFlightHeader", () => {
  it("lists inProgress, inQa, and blocked tasks", () => {
    const tasks: Task[] = [
      makeTask({ id: 1, status: "backlog" }),
      makeTask({ id: 2, status: "inProgress" }),
      makeTask({ id: 3, status: "inQa" }),
      makeTask({ id: 4, status: "blocked" }),
      makeTask({ id: 5, status: "done" }),
    ];
    expect(inFlightTasks(tasks).map((t) => t.id)).toEqual([2, 3, 4]);
  });

  it("formats a single in-flight task as #id", () => {
    expect(formatInFlightHeader([makeTask({ id: 4, status: "inProgress" })])).toBe("#4");
  });

  it("formats multiple in-flight ids for Docker parallel", () => {
    expect(
      formatInFlightHeader([
        makeTask({ id: 2, status: "inProgress" }),
        makeTask({ id: 7, status: "inQa" }),
      ]),
    ).toBe("#2 #7");
  });

  it("does not show a done leftover currentTaskNum when nothing is in flight", () => {
    expect(
      formatInFlightHeader([makeTask({ id: 1, status: "done" })], 1),
    ).toBe("#0");
  });
});
