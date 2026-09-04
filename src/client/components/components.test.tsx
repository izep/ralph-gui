// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ErrorBanner } from "./ErrorBanner";
import { KanbanColumn } from "./KanbanColumn";
import { LogViewer } from "./LogViewer";
import { TaskCard } from "./TaskCard";
import { ControlPanel } from "./ControlPanel";
import type { Task, ColumnDef, Settings, Readiness } from "../types";

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = () => { };
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
        onRestart={() => { }}
        onDismiss={() => { }}
      />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onRestart when Restart Loop button is clicked", () => {
    let restarted = false;
    render(
      <ErrorBanner
        error="fail"
        onRestart={() => { restarted = true; }}
        onDismiss={() => { }}
      />
    );
    fireEvent.click(screen.getByText("Restart Loop"));
    expect(restarted).toBe(true);
  });

  it("calls onDismiss when Dismiss button is clicked", () => {
    let dismissed = false;
    render(
      <ErrorBanner
        error="fail"
        onRestart={() => { }}
        onDismiss={() => { dismissed = true; }}
      />
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
  beforeEach(() => {
    try {
      localStorage.removeItem("ralph.logviewer.height");
    } catch {
      // ignore
    }
  });

  it("renders log lines", () => {
    render(
      <LogViewer
        lines={["[ralph] Started", "[dev] Working on task"]}
        onClose={() => { }}
      />
    );
    expect(screen.getByTitle("[ralph] Started")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Working on task")).toBeInTheDocument();
  });

  it("shows Ralph mascot art on the first [ralph] line in a run", () => {
    render(
      <LogViewer
        lines={[
          "[ralph] Ralph loop started",
          "[ralph] Planning iteration #1...",
          "[dev] Working on task",
        ]}
        onClose={() => { }}
      />
    );
    expect(document.querySelector(".log-line__header-art--ralph")).toBeInTheDocument();
    expect(document.querySelectorAll(".log-line__header-art--ralph")).toHaveLength(1);
    expect(screen.getAllByText("ralph").length).toBeGreaterThanOrEqual(1);
  });

  it("maps legacy [system] tags to [ralph] styling and mascot", () => {
    render(
      <LogViewer
        lines={["[system] Ralph loop started"]}
        onClose={() => { }}
      />
    );
    expect(document.querySelector(".log-line__header-art--ralph")).toBeInTheDocument();
    expect(screen.getAllByText("ralph").length).toBeGreaterThanOrEqual(1);
  });

  it("shows line count", () => {
    render(
      <LogViewer
        lines={["line 1", "line 2", "line 3"]}
        onClose={() => { }}
      />
    );
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("shows empty message when no lines", () => {
    render(<LogViewer lines={[]} onClose={() => { }} />);
    expect(screen.getByText("No output yet")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    let closed = false;
    render(
      <LogViewer
        lines={[]}
        onClose={() => { closed = true; }}
      />
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
      />
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
    const task = makeTask({ id: 1, description: "Full description content here" });
    render(<TaskCard task={task} />);

    // Initially shows "details" link
    expect(screen.getByText("details")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("details"));
    expect(screen.getByText("collapse")).toBeInTheDocument();
    expect(screen.getByText("Full description content here")).toBeInTheDocument();
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
  maxLLMCalls: 500,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5.4-mini",
  qaModel: "gpt-5.4-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: true,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  fleetMode: true,
  useDocker: false,
  dockerComposeFile: "",
  dockerService: "ralph-agent",
  epicBaseBranch: "",
  dockerWorkBranch: "",
  dockerIsolateBranch: true,
  dockerMergeStrategy: "work-branch",
  dockerPoolSize: 1,
  dockerParallelTasks: false,
  dockerPlanParallel: false,
  dockerInstalledBackends: [],
  dockerMountSocket: false,
  dockerAutoMergeEpicWork: true,
  copilotOutputFormat: "streaming",
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "updatedAtDesc",
  savedModelsByBackend: {},
  agentIdleTimeoutMinutes: 10,
  agentTimeoutMinutes: 0,
  agentMaxConsecutiveRepeats: 10,
};

const readyState: Readiness = {
  repoConfigured: true,
  requirementsFound: true,
  requirementsFile: "requirements.md",
  gitBranch: "main",
  epicConfigured: true,
};

describe("ControlPanel", () => {
  const noop = async () => { };
  const noopResult = async () => ({ ok: true });
  const noopContent = async () => ({ ok: true, content: "" });
  const noopDocker = async () => ({ ok: true });
  const noopMerge = async () => ({ ok: true });

  function renderPanel(isRunning = false) {
    return render(
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
        onSetEpicFile={noopContent}
        onCreateEpicFile={noopContent}
        onValidateDocker={noopDocker}
        onMergeEpicWork={noopMerge}
        isRunning={isRunning}
        onClose={() => { }}
      />
    );
  }

  it("renders settings header and section titles", () => {
    renderPanel();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("Loop Configuration")).toBeInTheDocument();
    expect(screen.getByText("Current Epic")).toBeInTheDocument();
    expect(screen.getByText("Prompts")).toBeInTheDocument();
  });

  it("shows git branch when available", () => {
    renderPanel();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows close button when repo is configured", () => {
    renderPanel();
    // Close button uses × character
    expect(screen.getAllByText("×").length).toBeGreaterThan(0);
  });

  it("shows Copilot log format when agent backend is copilot", () => {
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
        onSetEpicFile={noopContent}
        onCreateEpicFile={noopContent}
        onValidateDocker={noopDocker}
        onMergeEpicWork={noopMerge}
        isRunning={false}
        onClose={() => { }}
      />
    );
    expect(screen.getByText("Copilot Log Format")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Streaming JSONL/ })).toBeInTheDocument();
  });

  it("hides Copilot log format for non-copilot backends", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, agentBackend: "claude" }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        onSetEpicFile={noopContent}
        onCreateEpicFile={noopContent}
        onValidateDocker={noopDocker}
        onMergeEpicWork={noopMerge}
        isRunning={false}
        onClose={() => { }}
      />
    );
    expect(screen.queryByText("Copilot Log Format")).not.toBeInTheDocument();
  });

  it("disables Refresh Backlog when running", () => {
    renderPanel(true);
    const btn = screen.getByText("Refresh Tasks");
    expect(btn).toBeDisabled();
  });

  it("renders Docker Agents section", () => {
    renderPanel();
    expect(screen.getByText("Docker Agents")).toBeInTheDocument();
  });

  it("fleet checkbox enabled when agent backend is claude", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, agentBackend: "claude" }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        onSetEpicFile={noopContent}
        onCreateEpicFile={noopContent}
        onValidateDocker={noopDocker}
        onMergeEpicWork={noopMerge}
        isRunning={false}
        onClose={() => { }}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /fleet mode/i });
    expect(checkbox).toBeEnabled();
  });

  it("fleet checkbox enabled when agent backend is copilot", () => {
    renderPanel();
    const checkbox = screen.getByRole("checkbox", { name: /fleet mode/i });
    expect(checkbox).not.toBeDisabled();
  });

  it("Epic Set button is present", () => {
    renderPanel();
    // There should be a Set button in the Epic File row
    const setButtons = screen.getAllByText("Set");
    expect(setButtons.length).toBeGreaterThan(0);
  });

  it("Set Docker button calls validate API and shows success", async () => {
    const onValidateDocker = vi.fn(async () => ({ ok: true }));
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={onValidateDocker}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );

    fireEvent.click(screen.getByText("Set Docker"));
    await waitFor(() => expect(onValidateDocker).toHaveBeenCalledTimes(1));
  });

  it("Set Docker shows error message when validation fails", async () => {
    const onValidateDocker = vi.fn(async () => ({ ok: false, reason: 'not_running', message: 'Daemon not running' }));
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={{ ...readyState, dockerHostOk: false, dockerHostError: 'Daemon not running' }}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={onValidateDocker}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );

    fireEvent.click(screen.getByText("Set Docker"));
    expect(await screen.findByText(/Daemon not running/)).toBeInTheDocument();
  });

  it("Pool size input is present when useDocker is true", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );
    expect(screen.getByText("Pool size")).toBeInTheDocument();
  });

  it("Run backlog tasks in parallel checkbox is disabled when dockerPoolSize is 1", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true, dockerPoolSize: 1 }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );
    const parallel = screen.getByLabelText(/Run backlog tasks in parallel/i);
    expect((parallel as HTMLInputElement).disabled).toBe(true);
  });

  it("Run backlog tasks in parallel checkbox is enabled when dockerPoolSize > 1", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true, dockerPoolSize: 2 }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );
    const parallel = screen.getByLabelText(/Run backlog tasks in parallel/i);
    expect((parallel as HTMLInputElement).disabled).toBe(false);
  });

  it("Parallel plan research checkbox is disabled when dockerPoolSize is 1", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true, dockerPoolSize: 1 }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );
    const planParallel = screen.getByLabelText(/Parallel plan research/i);
    expect((planParallel as HTMLInputElement).disabled).toBe(true);
  });

  it("Parallel plan research checkbox is enabled when dockerPoolSize > 1", () => {
    render(
      <ControlPanel
        settings={{ ...defaultSettings, useDocker: true, dockerPoolSize: 2 }}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );
    const planParallel = screen.getByLabelText(/Parallel plan research/i);
    expect((planParallel as HTMLInputElement).disabled).toBe(false);
  });

  it("keeps a dirty epic draft when the server epic prop changes", () => {
    const { rerender } = render(
      <ControlPanel
        settings={defaultSettings}
        epic="Server A"
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />,
    );
    const ta = screen.getByPlaceholderText(/Describe the current epic/i);
    fireEvent.change(ta, { target: { value: "My unsaved draft" } });
    rerender(
      <ControlPanel
        settings={defaultSettings}
        epic="Server B from websocket"
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />,
    );
    expect(screen.getByPlaceholderText(/Describe the current epic/i)).toHaveValue("My unsaved draft");
  });

  it("loads plan prompt text when prompts arrive after mount", () => {
    const { rerender } = render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />,
    );
    rerender(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{ "plan-prompt.md": "# Plan\n\nSurvey the codebase." }}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={async () => ({ ok: true, content: "" })}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />,
    );
    expect(screen.getByDisplayValue(/Survey the codebase/)).toBeInTheDocument();
  });


  it("Epic Set button calls set-file API and loads content", async () => {
    const onSetEpicFile = vi.fn(async (_path: string) => ({ ok: true, content: "# Epic content" }));
    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={onSetEpicFile}
        onCreateEpicFile={async () => ({ ok: true, content: "" })}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );

    const setBtn = screen.getByTitle("Load epic content from this path (or create if not found)");
    fireEvent.click(setBtn);

    await waitFor(() => expect(onSetEpicFile).toHaveBeenCalledWith(defaultSettings.epicFile));
    expect(await screen.findByText(/Loaded!/)).toBeInTheDocument();
  });

  it("Epic Set button shows dialog when file not found and Create triggers create-file API", async () => {
    const onSetEpicFile = vi.fn(async (_path: string) => ({ ok: false, notFound: true }));
    const onCreateEpicFile = vi.fn(async (_path: string) => ({ ok: true, content: "# Created" }));

    render(
      <ControlPanel
        settings={defaultSettings}
        epic=""
        prompts={{}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={async () => { }}
        onSaveEpic={async () => { }}
        onSavePrompt={async () => { }}
        onSetRepo={async () => ({ ok: true })}
        onRefreshBacklog={async () => ({ ok: true })}
        onSetEpicFile={onSetEpicFile}
        onCreateEpicFile={onCreateEpicFile}
        onValidateDocker={async () => ({ ok: true })}
        onMergeEpicWork={async () => ({ ok: true })}
        isRunning={false}
        onClose={() => { }}
      />
    );

    const setBtn = screen.getByTitle("Load epic content from this path (or create if not found)");
    fireEvent.click(setBtn);

    // Dialog should appear
    expect(await screen.findByText(/Epic file not found/)).toBeInTheDocument();

    // Click Create in dialog
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(onCreateEpicFile).toHaveBeenCalledWith(defaultSettings.epicFile));
  });
});

// ---------------------------------------------------------------------------
// LoopConfigSection — model dropdowns and View models link
// ---------------------------------------------------------------------------

import { LoopConfigSection } from "./LoopConfigSection";

describe("LoopConfigSection model dropdowns", () => {
  it("shows copilot model options when agentBackend is copilot", () => {
    const settings: Settings = { ...defaultSettings, agentBackend: "copilot", planModel: "claude-sonnet-4.6", devModel: "gpt-5.4-mini", qaModel: "gpt-5.4-mini" };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />
    );
    // Verify the Plan Model label and a copilot-specific option text are present
    expect(screen.getByText("Plan Model")).toBeInTheDocument();
    expect(
      screen.getByText(/\(claude-sonnet-5\) Claude Sonnet 5 -- recommended for planning/),
    ).toBeInTheDocument();
  });

  it("restores saved copilot models when switching back from another backend", async () => {
    const copilotModels = {
      planModel: "claude-sonnet-4.6",
      devModel: "gpt-5.4-mini",
      qaModel: "gpt-5.4-mini",
    };
    let settings: Settings = {
      ...defaultSettings,
      agentBackend: "copilot",
      ...copilotModels,
      savedModelsByBackend: { copilot: copilotModels },
    };

    const { rerender } = render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={(s) => {
          settings = s;
        }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("GitHub Copilot CLI"), {
      target: { value: "claude" },
    });
    await waitFor(() => expect(settings.agentBackend).toBe("claude"));
    expect(settings.savedModelsByBackend?.copilot).toEqual(copilotModels);

    rerender(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={(s) => {
          settings = s;
        }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Claude Code (claude CLI)"), {
      target: { value: "copilot" },
    });
    await waitFor(() => {
      expect(settings.agentBackend).toBe("copilot");
      expect(settings.planModel).toBe("claude-sonnet-4.6");
      expect(settings.devModel).toBe("gpt-5.4-mini");
      expect(settings.qaModel).toBe("gpt-5.4-mini");
    });
  });

  it("uses cursor-agent CLI IDs for recommended plan model", () => {
    const settings: Settings = {
      ...defaultSettings,
      agentBackend: "cursor-agent",
      planModel: "claude-sonnet-5-thinking-high",
      devModel: "gpt-5-mini",
      qaModel: "gpt-5-mini",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />,
    );
    expect(
      screen.getByText(
        /\(claude-sonnet-5-thinking-high\) Claude Sonnet 5 -- recommended for planning/,
      ),
    ).toBeInTheDocument();
  });

  it("shows claude CLI hyphenated model options when agentBackend is claude", () => {
    const settings: Settings = {
      ...defaultSettings,
      agentBackend: "claude",
      planModel: "claude-opus-4-5",
      devModel: "claude-sonnet-5",
      qaModel: "claude-sonnet-5",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />,
    );
    expect(
      screen.getByText(/\(claude-opus-4-5\) Claude Opus 4.5 -- recommended for planning/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/\(claude-sonnet-5\) Claude Sonnet 5 -- recommended for (dev|qa)/).length,
    ).toBeGreaterThan(0);
  });

  it("shows opencode Zen free model options when agentBackend is opencode", () => {
    const settings: Settings = {
      ...defaultSettings,
      agentBackend: "opencode",
      planModel: "opencode/big-pickle",
      devModel: "opencode/deepseek-v4-flash-free",
      qaModel: "opencode/deepseek-v4-flash-free",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />,
    );
    expect(
      screen.getByText(/\(opencode\/big-pickle\) Big Pickle -- recommended for planning/),
    ).toBeInTheDocument();
  });

  it("View models link uses current backend in URL", () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    const settings: Settings = {
      ...defaultSettings,
      agentBackend: "gemini",
      planModel: "gemini-2.5-pro",
      devModel: "gemini-2.5-flash",
      qaModel: "gemini-2.5-flash",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        onSaveSettings={() => { }}
      />
    );
    const link = screen.getByText(/View models for/i);
    fireEvent.click(link);
    expect(openSpy).toHaveBeenCalledWith(
      "/models-reference?backend=gemini",
      "_blank",
      "noopener,width=960,height=720"
    );

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// ControlPanel — Phase 5: collapsible sections, dirty detection, Save/Reset
// ---------------------------------------------------------------------------

describe("ControlPanel Phase 5: collapsible and dirty/save/reset UX", () => {
  const noop = async () => { };
  const noopResult = async () => ({ ok: true });
  const noopContent = async () => ({ ok: true, content: "" });
  const noopDocker = async () => ({ ok: true });
  const noopMerge = async () => ({ ok: true });

  function renderPanel(
    overrideSettings: Partial<Settings> = {},
    overrideProps: {
      epic?: string;
      prompts?: Record<string, string>;
      onSaveSettings?: (s: Settings) => Promise<void>;
    } = {},
  ) {
    const settings = { ...defaultSettings, ...overrideSettings };
    return render(
      <ControlPanel
        settings={settings}
        epic={overrideProps.epic ?? ""}
        prompts={overrideProps.prompts ?? {}}
        repoRoot="/test/repo"
        readiness={readyState}
        onSaveSettings={overrideProps.onSaveSettings ?? noop}
        onSaveEpic={noop}
        onSavePrompt={noop}
        onSetRepo={noopResult}
        onRefreshBacklog={noopResult}
        onSetEpicFile={noopContent}
        onCreateEpicFile={noopContent}
        onValidateDocker={noopDocker}
        onMergeEpicWork={noopMerge}
        isRunning={false}
        onClose={() => { }}
      />
    );
  }

  // --- Collapse / Expand ---

  it("Collapse all hides Docker Agents, Loop Configuration, Current Epic, Prompts bodies", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Collapse all"));
    const headers = screen.getAllByRole("button", { name: /docker agents|loop configuration|current epic|prompts/i });
    for (const header of headers) {
      expect(header).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("Expand all restores all four sections after collapse", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Collapse all"));
    fireEvent.click(screen.getByText("Expand all"));
    const headers = screen.getAllByRole("button", { name: /docker agents|loop configuration|current epic|prompts/i });
    for (const header of headers) {
      expect(header).toHaveAttribute("aria-expanded", "true");
    }
  });

  it("clicking a section header toggles only that section", () => {
    renderPanel();
    const dockerHeader = screen.getByRole("button", { name: /docker agents/i });
    const loopHeader = screen.getByRole("button", { name: /loop configuration/i });
    const epicHeader = screen.getByRole("button", { name: /current epic/i });
    const promptsHeader = screen.getByRole("button", { name: /prompts/i });
    expect(dockerHeader).toHaveAttribute("aria-expanded", "false");
    expect(loopHeader).toHaveAttribute("aria-expanded", "false");
    expect(epicHeader).toHaveAttribute("aria-expanded", "false");
    expect(promptsHeader).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(dockerHeader);
    expect(dockerHeader).toHaveAttribute("aria-expanded", "true");
    expect(loopHeader).toHaveAttribute("aria-expanded", "false");
    expect(epicHeader).toHaveAttribute("aria-expanded", "false");
    expect(promptsHeader).toHaveAttribute("aria-expanded", "false");
  });

  // --- Save buttons disabled when pristine ---

  it("Save Docker is disabled when no docker changes made", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /save docker/i })).toBeDisabled();
  });

  it("Save loop settings is disabled when no loop changes made", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /save loop settings/i })).toBeDisabled();
  });

  it("Save epic is disabled when no epic changes made", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /save epic/i })).toBeDisabled();
  });

  it("Save Plan Prompt is disabled when no prompt changes made", () => {
    renderPanel({}, { prompts: { "plan-prompt.md": "original plan prompt" } });
    expect(screen.getByRole("button", { name: /save plan prompt/i })).toBeDisabled();
  });

  it("switching Plan/Dev/QA tabs shows that persona's saved prompt", () => {
    renderPanel({}, {
      prompts: {
        "plan-prompt.md": "# Plan prompt body",
        "dev-prompt.md": "# Dev prompt body",
        "qa-prompt.md": "# QA prompt body",
      },
    });
    expect(screen.getByLabelText("Plan prompt")).toHaveValue("# Plan prompt body");
    fireEvent.click(screen.getByRole("button", { name: /^dev$/i }));
    expect(screen.getByLabelText("Dev prompt")).toHaveValue("# Dev prompt body");
    fireEvent.click(screen.getByRole("button", { name: /^qa$/i }));
    expect(screen.getByLabelText("QA prompt")).toHaveValue("# QA prompt body");
  });

  it("alerts and stays on the current persona when the prompt is unsaved", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => { });
    renderPanel({}, {
      prompts: {
        "plan-prompt.md": "# Plan prompt body",
        "dev-prompt.md": "# Dev prompt body",
        "qa-prompt.md": "# QA prompt body",
      },
    });
    fireEvent.change(screen.getByLabelText("Plan prompt"), {
      target: { value: "unsaved plan draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^dev$/i }));
    expect(alertSpy).toHaveBeenCalledWith(
      "Save or reset the Plan prompt before switching to Dev.",
    );
    expect(screen.getByLabelText("Plan prompt")).toHaveValue("unsaved plan draft");
    expect(screen.getByRole("button", { name: /^plan$/i })).toHaveClass("cp-tab--active");
    alertSpy.mockRestore();
  });

  // --- Editing a docker field enables Save Docker only ---

  it("editing dockerPoolSize enables Save Docker but not Save loop settings", () => {
    renderPanel({ useDocker: true });
    const poolInput = screen.getByLabelText(/pool size/i);
    fireEvent.change(poolInput, { target: { value: "3" } });
    expect(screen.getByRole("button", { name: /save docker/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save loop settings/i })).toBeDisabled();
  });

  // --- Editing a loop field enables Save loop settings only ---

  it("editing maxLLMCalls enables Save loop settings but not Save Docker", () => {
    renderPanel();
    const maxCallsInput = screen.getByLabelText(/max llm calls/i);
    expect(maxCallsInput).toHaveValue(500);
    fireEvent.change(maxCallsInput, { target: { value: "50" } });
    expect(screen.getByRole("button", { name: /save loop settings/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save docker/i })).toBeDisabled();
  });

  // --- Editing epic textarea enables Save epic ---

  it("editing epic textarea enables Save epic", () => {
    renderPanel({}, { epic: "initial epic" });
    const textarea = screen.getAllByRole("textbox").find(
      (el) => (el as HTMLTextAreaElement).value === "initial epic",
    ) as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    fireEvent.change(textarea, { target: { value: "updated epic" } });
    expect(screen.getByRole("button", { name: /save epic/i })).not.toBeDisabled();
  });

  // --- Reset docker reverts draft and disables Save Docker ---

  it("Reset for Docker reverts docker draft and disables Save Docker", () => {
    renderPanel({ useDocker: true });
    const poolInput = screen.getByLabelText(/pool size/i);
    fireEvent.change(poolInput, { target: { value: "3" } });
    expect(screen.getByRole("button", { name: /save docker/i })).not.toBeDisabled();

    const dockerSection = screen.getByRole("button", { name: /docker agents/i }).closest("section")!;
    fireEvent.click(within(dockerSection).getByRole("button", { name: /^reset$/i }));
    expect(screen.getByRole("button", { name: /save docker/i })).toBeDisabled();
  });

  // --- Reset loop reverts draft and disables Save loop settings ---

  it("Reset for Loop reverts loop draft and disables Save loop settings", () => {
    renderPanel();
    const maxCallsInput = screen.getByLabelText(/max llm calls/i);
    fireEvent.change(maxCallsInput, { target: { value: "50" } });
    expect(screen.getByRole("button", { name: /save loop settings/i })).not.toBeDisabled();

    const loopSection = screen.getByRole("button", { name: /loop configuration/i }).closest("section")!;
    fireEvent.click(within(loopSection).getByRole("button", { name: /^reset$/i }));
    expect(screen.getByRole("button", { name: /save loop settings/i })).toBeDisabled();
  });

  // --- epicFile path change marks epic dirty ---

  it("changing epicFile path marks epic dirty", () => {
    renderPanel({ epicFile: "ralph/epic.md" });
    const epicFileInput = screen.getByDisplayValue("ralph/epic.md");
    fireEvent.change(epicFileInput, { target: { value: "ralph/new-epic.md" } });
    expect(screen.getByRole("button", { name: /save epic/i })).not.toBeDisabled();
  });

  // --- Secondary actions not gated on dirty state ---

  it("Set Docker button is enabled regardless of dirty state", () => {
    renderPanel({ useDocker: true });
    const setDockerBtn = screen.getByRole("button", { name: /^set docker$/i });
    expect(setDockerBtn).not.toBeDisabled();
  });

  it("Refresh Tasks button is enabled regardless of dirty state", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /refresh tasks/i })).not.toBeDisabled();
  });

  it("Set epic file button is enabled regardless of dirty state", () => {
    renderPanel();
    const setButtons = screen.getAllByTitle(/load epic content/i);
    expect(setButtons[0]).not.toBeDisabled();
  });

  // --- dockerAutoMergeEpicWork dirty detection and visibility ---

  it("dockerAutoMergeEpicWork checkbox hidden when isolation is off", () => {
    renderPanel({ dockerIsolateBranch: false });
    expect(screen.queryByLabelText(/automatically merge work into epic branch/i)).toBeNull();
  });

  it("dockerAutoMergeEpicWork checkbox visible when isolation is on", () => {
    renderPanel({ useDocker: true, dockerIsolateBranch: true });
    expect(screen.getByLabelText(/automatically merge work into epic branch/i)).toBeInTheDocument();
  });

  it("toggling dockerAutoMergeEpicWork enables Save Docker but not Save loop settings", () => {
    renderPanel({ useDocker: true, dockerIsolateBranch: true, dockerAutoMergeEpicWork: true });
    const checkbox = screen.getByLabelText(/automatically merge work into epic branch/i);
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: /save docker/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save loop settings/i })).toBeDisabled();
  });

  // --- dockerMergeStrategy ---

  it("hides isolate and manual merge when epic-base-per-task strategy is selected", () => {
    renderPanel({ useDocker: true, dockerMergeStrategy: "epic-base-per-task" });
    expect(screen.queryByLabelText(/isolate on work branch/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /merge work into epic branch/i })).toBeNull();
    expect(screen.getByText(/merge each task immediately/i)).toBeInTheDocument();
  });

  it("changing dockerMergeStrategy enables Save Docker", () => {
    renderPanel({ useDocker: true, dockerMergeStrategy: "work-branch" });
    fireEvent.change(screen.getByLabelText(/git merge strategy/i), {
      target: { value: "epic-base-per-task" },
    });
    expect(screen.getByRole("button", { name: /save docker/i })).not.toBeDisabled();
  });
});
