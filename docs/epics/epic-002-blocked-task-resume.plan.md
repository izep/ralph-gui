# Blocked Task Resolution Flow

## Goal
Add a `blocker resolved` checkbox on blocked tasks in the UI, persist that state through the existing status store, and automatically move the task from `blocked` to `backlog` while preserving backlog order semantics.

## Implementation Plan

- Update task model/types to represent resolved blocker state and preserve blocker metadata needed for traceability.
  - Files: [src/client/types.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/client/types.ts), [src/server/task-manager.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/task-manager.ts)
  - Add fields such as `blocked.resolved` and `blocked.resolvedAt` (or equivalent), while keeping existing blocker details (`summary`, `impact`, `nextStep`, `needs`).

- Add UI control for blocked tasks.
  - File: [src/client/components/TaskCard.tsx](/home/roy28095/github/third-party/hpractv/ralph-gui/src/client/components/TaskCard.tsx)
  - Render a checkbox only for `status === "blocked"` labeled `Blocker resolved`.
  - On check, call the existing status update path to set the task back to `backlog` and persist resolved blocker metadata.

- Implement server-side requeue transition with stable backlog ordering.
  - Files: [src/server/task-manager.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/task-manager.ts), [src/server/ralph-loop.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/ralph-loop.ts)
  - Add/extend a transition helper so `blocked -> backlog` inserts the task into backlog without jumping to front/back incorrectly (preserve existing relative backlog order; resolved tasks re-enter in a deterministic stable position).
  - Ensure `setTaskStatus` does not discard blocker context before resolution metadata is captured.

- Keep execution behavior context-aware when the task is retried.
  - File: [src/server/ralph-loop.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/ralph-loop.ts)
  - Confirm the resumed/requeued task still contributes its `Current Task` description to dev/qa prompts (already present), and include blocker history if useful for retry guidance.

- Update prompt guidance and persisted local prompt copies if needed.
  - Files: [src/server/prompts/dev-prompt.md](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/prompts/dev-prompt.md), [ralph/dev-prompt.md](/home/roy28095/github/third-party/hpractv/ralph-gui/ralph/dev-prompt.md)
  - Clarify that blocked tasks may be user-resolved and requeued, so downstream execution should treat them as normal backlog tasks with historical blocker context.

- Add/adjust tests for transition correctness.
  - Files: [src/server/ralph-loop.test.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/ralph-loop.test.ts), [src/server/parsers.test.ts](/home/roy28095/github/third-party/hpractv/ralph-gui/src/server/parsers.test.ts), plus any client component tests for `TaskCard`.
  - Validate: checkbox visibility on blocked tasks, `blocked -> backlog` transition, stable ordering behavior, and prompt/task-context continuity after requeue.

## Validation

- Manually verify in UI:
  - Blocked card shows checkbox.
  - Checking it requeues the task to backlog and removes blocked-only rendering.
  - Task later executes with expected task context.
- Run test suite sections covering task-manager/loop and UI component behavior.
