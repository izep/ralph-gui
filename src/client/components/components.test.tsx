// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
  it("renders log lines", () => {
    render(
      <LogViewer
        lines={["[system] Started", "[dev] Working on task"]}
        onClose={() => { }}
      />
    );
    expect(screen.getByText("[system] Started")).toBeInTheDocument();
    expect(screen.getByText("[dev] Working on task")).toBeInTheDocument();
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
  maxLLMCalls: 100,
  planModel: "claude-sonnet-4.6",
  devModel: "gpt-5.4-mini",
  qaModel: "gpt-5.4-mini",
  devReasoningEffort: "xhigh",
  qaReasoningEffort: "high",
  autoCommit: false,
  planFrequency: 1,
  minBacklogSize: 3,
  agentBackend: "copilot",
  fleetMode: false,
  useDocker: false,
  dockerComposeFile: "",
  dockerService: "ralph-agent",
  epicBaseBranch: "",
  dockerWorkBranch: "",
  dockerIsolateBranch: true,
  dockerPoolSize: 1,
  dockerParallelTasks: false,
  dockerInstalledBackends: [],
  dockerMountSocket: false,
  epicFile: "ralph/epic.md",
  requirementsFile: "",
  pauseAfterPlan: false,
  taskColumnSort: "idAsc",
  savedModelsByBackend: {},
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

  it("disables Refresh Backlog when running", () => {
    renderPanel(true);
    const btn = screen.getByText("Refresh Tasks");
    expect(btn).toBeDisabled();
  });

  it("renders Docker Agents section", () => {
    renderPanel();
    expect(screen.getByText("Docker Agents")).toBeInTheDocument();
  });

  it("fleet checkbox disabled when agent backend is not copilot", () => {
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
    expect(checkbox).toBeDisabled();
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
        settingsSaved={false}
        onSaveSettings={() => { }}
      />
    );
    // Verify the Plan Model label and a copilot-specific option text are present
    expect(screen.getByText("Plan Model")).toBeInTheDocument();
    expect(
      screen.getByText(/\(claude-sonnet-4\.6\) Claude Sonnet 4\.6 -- recommended for planning/),
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
        settingsSaved={false}
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
        settingsSaved={false}
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
      planModel: "claude-4.6-sonnet-medium",
      devModel: "gpt-5-mini",
      qaModel: "gpt-5-mini",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        settingsSaved={false}
        onSaveSettings={() => { }}
      />,
    );
    expect(
      screen.getByText(
        /\(claude-4\.6-sonnet-medium\) Claude Sonnet 4\.6 -- recommended for planning/,
      ),
    ).toBeInTheDocument();
  });

  it("shows claude CLI hyphenated model options when agentBackend is claude", () => {
    const settings: Settings = {
      ...defaultSettings,
      agentBackend: "claude",
      planModel: "claude-sonnet-4-6",
      devModel: "claude-haiku-4-5",
      qaModel: "claude-haiku-4-5",
    };
    render(
      <LoopConfigSection
        localSettings={settings}
        onChangeSettings={() => { }}
        repoLocked={false}
        settingsSaved={false}
        onSaveSettings={() => { }}
      />,
    );
    expect(
      screen.getByText(/\(claude-sonnet-4-6\) Claude Sonnet 4\.6 -- recommended for planning/),
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
        settingsSaved={false}
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
