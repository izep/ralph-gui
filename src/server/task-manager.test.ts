import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import { TaskManager } from "./task-manager.js";

let tmp: string;

function withFlowState<T extends {
  tasks: unknown[];
  currentTaskNum: number;
  totalLLMCalls: number;
  maxLLMCalls: number;
  lastUpdated: string;
}>(data: T) {
  return {
    ...data,
    nextTask: {
      taskId: null,
      content: "",
      updatedAt: data.lastUpdated,
    },
    feedback: {
      taskId: null,
      content: "",
      updatedAt: data.lastUpdated,
    },
  };
}

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "ralph-test-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("TaskManager.syncBacklogTasks ordering", () => {
  it("preserves non-backlog tasks in original order when incoming includes them", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    const initial = {
      tasks: [
        {
          id: 1,
          title: "Existing non-backlog",
          description: "",
          status: "inProgress",
          devIterations: 2,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 2,
          title: "Old backlog",
          description: "",
          status: "backlog",
          devIterations: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    } as any;

    await tm.writeStatus(initial);

    const incoming = [
      { id: 2, title: "Old backlog", description: "", status: "backlog" },
      { id: 1, title: "Existing non-backlog updated", description: "updated", status: "inProgress" },
    ];

    await tm.syncBacklogTasks(incoming as any);
    const res = await tm.readStatus();
    expect(res.tasks.length).toBe(2);
    expect(res.tasks[0].id).toBe(1);
    expect(res.tasks[0].title).toBe("Existing non-backlog updated");
    expect(res.tasks[1].id).toBe(2);
  });

  it("promotes existing backlog to non-backlog when incoming has non-backlog", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    const initial = {
      tasks: [
        {
          id: 5,
          title: "Backlog task",
          description: "",
          status: "backlog",
          devIterations: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    } as any;

    await tm.writeStatus(initial);

    const incoming = [
      { id: 5, title: "Backlog task promoted", description: "desc", status: "inProgress" },
      { id: 6, title: "New backlog item", description: "", status: "backlog" },
    ];

    await tm.syncBacklogTasks(incoming as any);
    const res = await tm.readStatus();
    expect(res.tasks[0].id).toBe(5);
    expect(res.tasks[0].status).toBe("inProgress");
    expect(res.tasks[0].devIterations).toBe(1);
    expect(res.tasks[1].id).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// setTaskStatus
// ---------------------------------------------------------------------------

describe("TaskManager.setTaskStatus", () => {
  it("creates a new task entry when task ID does not exist", async () => {
    const tm = new TaskManager(tmp);
    await tm.writeStatus(withFlowState({
      tasks: [],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: new Date().toISOString(),
    }));

    await tm.setTaskStatus(1, "inProgress", 3, 100, "New task", "A description", 0);
    const res = await tm.readStatus();
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].id).toBe(1);
    expect(res.tasks[0].title).toBe("New task");
    expect(res.tasks[0].description).toBe("A description");
    expect(res.tasks[0].status).toBe("inProgress");
    expect(res.currentTaskNum).toBe(1);
    expect(res.totalLLMCalls).toBe(3);
  });

  it("updates existing task status and preserves title when not provided", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    await tm.writeStatus(withFlowState({
      tasks: [{ id: 1, title: "Original", description: "desc", status: "backlog", devIterations: 0, createdAt: now, updatedAt: now }],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    }));

    await tm.setTaskStatus(1, "done", 5, 100);
    const res = await tm.readStatus();
    expect(res.tasks[0].status).toBe("done");
    expect(res.tasks[0].title).toBe("Original");
  });

  it("updates devIterations when provided", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    await tm.writeStatus(withFlowState({
      tasks: [{ id: 1, title: "T", description: "", status: "inProgress", devIterations: 0, createdAt: now, updatedAt: now }],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    }));

    await tm.setTaskStatus(1, "inQa", 2, 100, "", "", 3);
    const res = await tm.readStatus();
    expect(res.tasks[0].devIterations).toBe(3);
  });

  it("fires onUpdated callback", async () => {
    const updates: object[] = [];
    const tm = new TaskManager(tmp, (data) => updates.push(data));
    await tm.writeStatus(withFlowState({
      tasks: [],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: new Date().toISOString(),
    }));

    await tm.setTaskStatus(1, "backlog", 0, 100, "Callback task");
    expect(updates.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// syncBacklogTasksByTitle
// ---------------------------------------------------------------------------

describe("TaskManager.syncBacklogTasksByTitle", () => {
  it("assigns new IDs for unknown titles", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    await tm.writeStatus(withFlowState({
      tasks: [{ id: 3, title: "Existing", description: "", status: "done", devIterations: 1, createdAt: now, updatedAt: now }],
      currentTaskNum: 3,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    }));

    await tm.syncBacklogTasksByTitle(["Existing", "Brand new task", "Another new"]);
    const res = await tm.readStatus();

    // "Existing" should keep ID 3, new tasks get 4 and 5
    const existingTask = res.tasks.find((t) => t.title === "Existing");
    expect(existingTask?.id).toBe(3);

    const newTask = res.tasks.find((t) => t.title === "Brand new task");
    expect(newTask).toBeDefined();
    expect(newTask!.id).toBe(4);
    expect(newTask!.status).toBe("backlog");

    const anotherNew = res.tasks.find((t) => t.title === "Another new");
    expect(anotherNew!.id).toBe(5);
  });

  it("preserves existing task IDs for known titles", async () => {
    const tm = new TaskManager(tmp);
    const now = new Date().toISOString();
    await tm.writeStatus(withFlowState({
      tasks: [
        { id: 1, title: "Task A", description: "", status: "backlog", devIterations: 0, createdAt: now, updatedAt: now },
        { id: 2, title: "Task B", description: "", status: "backlog", devIterations: 0, createdAt: now, updatedAt: now },
      ],
      currentTaskNum: 0,
      totalLLMCalls: 0,
      maxLLMCalls: 100,
      lastUpdated: now,
    }));

    await tm.syncBacklogTasksByTitle(["Task B", "Task A"]);
    const res = await tm.readStatus();
    expect(res.tasks.find((t) => t.title === "Task B")?.id).toBe(2);
    expect(res.tasks.find((t) => t.title === "Task A")?.id).toBe(1);
  });
});
