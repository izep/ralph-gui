// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ErrorBanner } from "./ErrorBanner";
import { KanbanColumn } from "./KanbanColumn";
import { LogViewer } from "./LogViewer";
import { TaskCard } from "./TaskCard";
import { ControlPanel } from "./ControlPanel";
import type { ColumnDef, Readiness, Settings, Task } from "../types";

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------

describe("ErrorBanner", () => {
  it("renders the error message", () => {
    render(
      <ErrorBanner
        error="Something went wrong"
        onRestart={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onRestart when Restart Loop button is clicked", () => {
    let restarted = false;
    render(
      <ErrorBanner
        error="fail"
        onRestart={() => {
          restarted = true;
        }}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Restart Loop"));
    expect(restarted).toBe(true);
  });

  it("calls onDismiss when Dismiss button is clicked", () => {
    let dismissed = false;
    render(
      <ErrorBanner
        error="fail"
        onRestart={() => {}}
        onDismiss={() => {
          dismissed = true;
        }}
      />,
    );
    fireEvent.click(screen.getByText("Dismiss"));
    expect(dismissed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

const backlogColumn: ColumnDef = {
  key: "backlog",
  label: "Backlog",
  color: "#6b7280",
  emptyMessage: "No tasks here",
};

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

describe("KanbanColumn", () => {
  it("renders column label and task count", () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2 })];
    render(<KanbanColumn column={backlogColumn} tasks={tasks} />);
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty message when there are no tasks", () => {
    render(<KanbanColumn column={backlogColumn} tasks={[]} />);
    expect(screen.getByText("No tasks here")).toBeInTheDocument();
  });

  it("renders task titles", () => {
    const tasks = [
      makeTask({ id: 1, title: "Fix the bug" }),
      makeTask({ id: 2, title: "Add feature" }),
    ];
    render(<KanbanColumn column={backlogColumn} tasks={tasks} />);
    expect(screen.getByText("Fix the bug")).toBeInTheDocument();
    expect(screen.getByText("Add feature")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LogViewer
// ---------------------------------------------------------------------------

describe("LogViewer", () => {
  it("renders log lines", () => {
    render(
      <LogViewer
        lines={["[system] Started", "[dev] Working on task"]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("[system] Started")).toBeInTheDocument();
    expect(screen.getByText("[dev] Working on task")).toBeInTheDocument();
  });

  it("shows line count", () => {
    render(
      <LogViewer
        lines={["line 1", "line 2", "line 3"]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("shows empty message when no lines", () => {
    render(<LogViewer lines={[]} onClose={() => {}} />);
    expect(screen.getByText("No output yet")).toBeInTheDocument();
  });

  it("renders a resize separator for the log drawer", () => {
    render(<LogViewer lines={[]} onClose={() => {}} />);
    expect(screen.getByLabelText("Resize output log")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    let closed = false;
    render(
      <LogViewer
        lines={[]}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    fireEvent.click(screen.getByText("×"));
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

describe("TaskCard", () => {
  it("renders task ID and title", () => {
    render(<TaskCard task={makeTask({ id: 42, title: "Fix the bug" })} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Fix the bug")).toBeInTheDocument();
  });

  it("shows BLOCKED badge for blocked tasks", () => {
    render(<TaskCard task={makeTask({ id: 1, status: "blocked" })} />);
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
  });

  it("shows blocked metadata when provided", () => {
    render(
      <TaskCard
        task={makeTask({
          id: 7,
          status: "blocked",
          blocked: {
            summary: "Missing API key",
            impact: "Cannot run integration tests",
            nextStep: "Provide CI secret",
            needs: "API_KEY in env",
            capturedAt: "2026-01-01T00:00:00Z",
          },
        })}
      />,
    );

    expect(screen.getByText("Summary:")).toBeInTheDocument();
    expect(screen.getByText(/Missing API key/)).toBeInTheDocument();
    expect(screen.getByText("Next:")).toBeInTheDocument();
    expect(screen.getByText(/Provide CI secret/)).toBeInTheDocument();
  });

  it("shows iteration count badge", () => {
    render(<TaskCard task={makeTask({ id: 1, devIterations: 3 })} />);
    expect(screen.getByText("3 iterations")).toBeInTheDocument();
  });

  it("shows singular iteration label for 1 iteration", () => {
    render(<TaskCard task={makeTask({ id: 1, devIterations: 1 })} />);
    expect(screen.getByText("1 iteration")).toBeInTheDocument();
  });

  it("expands description on click", () => {
    const task = makeTask({
      id: 1,
      description: "Full description content here",
    });
    render(<TaskCard task={task} />);

    // Initially shows "details" link
    expect(screen.getByText("details")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("details"));
    expect(screen.getByText("collapse")).toBeInTheDocument();
    expect(screen.getByText("Full description content here"))
      .toBeInTheDocument();
  });

  it("shows Blocker resolved checkbox for blocked tasks with blocked metadata", () => {
    render(
      <TaskCard
        task={makeTask({
          id: 3,
          status: "blocked",
          blocked: {
            summary: "Need access",
            impact: "Blocks CI",
            nextStep: "Request access",
            needs: "credentials",
            capturedAt: "2026-01-01T00:00:00Z",
          },
        })}
      />
    );
    expect(screen.getByLabelText(/Blocker resolved/)).toBeInTheDocument();
  });

  it("does not show Blocker resolved checkbox for non-blocked tasks", () => {
    render(<TaskCard task={makeTask({ id: 4, status: "backlog" })} />);
    expect(screen.queryByLabelText(/Blocker resolved/)).not.toBeInTheDocument();
  });

  it("does not show Blocker resolved checkbox for inProgress tasks", () => {
    render(<TaskCard task={makeTask({ id: 5, status: "inProgress" })} />);
    expect(screen.queryByLabelText(/Blocker resolved/)).not.toBeInTheDocument();
  });

  it("does not show Blocker resolved checkbox for done tasks", () => {
    render(<TaskCard task={makeTask({ id: 6, status: "done" })} />);
    expect(screen.queryByLabelText(/Blocker resolved/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ControlPanel
// ---------------------------------------------------------------------------

const defaultSettings: Settings = {
  maxLLMCalls: 100,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5-mini",
  qaModel: "gpt-5-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: false,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "idAsc",
};

const readyState: Readiness = {
  repoConfigured: true,
  requirementsFound: true,
  requirementsFile: "requirements.md",
  gitBranch: "main",
  epicConfigured: true,
};

describe("ControlPanel", () => {
  const noop = async () => {};
  const noopResult = async () => ({ ok: true });

  it("renders settings header and section titles", () => {
    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        isRunning={false}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("Loop Configuration")).toBeInTheDocument();
    expect(screen.getByText("Current Epic")).toBeInTheDocument();
    expect(screen.getByText("Prompts")).toBeInTheDocument();
  });

  it("shows git branch when available", () => {
    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        isRunning={false}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows close button when repo is configured", () => {
    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        isRunning={false}
        onClose={() => {}}
      />,
    );
    // Close button uses × character
    expect(screen.getAllByText("×").length).toBeGreaterThan(0);
  });

  it("disables Refresh Backlog when running", () => {
    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        isRunning={true}
        onClose={() => {}}
      />,
    );
    const btn = screen.getByText("Refresh Tasks");
    expect(btn).toBeDisabled();
  });
});
