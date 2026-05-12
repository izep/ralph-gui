---
name: Task Column Sort Setting
overview: "Add one persisted repository setting that controls how every task-status column is displayed: last edited ascending/descending or id ascending/descending. Presentation only; do not alter the mechanisms that advance tasks between statuses."
todos:
  - id: settings-type
    content: Add the task column sort setting to server and client Settings defaults/types.
    status: pending
  - id: sort-helper
    content: Implement a pure task sort helper and apply it to every task-status column.
    status: pending
  - id: settings-ui
    content: Add a Task Column Sort select control in the settings panel.
    status: pending
  - id: tests
    content: Add unit tests for sort modes and immutability, then run focused validation.
    status: pending
isProject: false
---

# Task Column Sort Setting

Add one shared task column sort setting with four allowed values, persisted in `ralph/settings.json` and exposed in the settings panel. The same setting applies independently to every task-status column.

## Out of scope

Do not change anything that determines **how tasks move between statuses** (for example backlog → in progress → QA → done): that pipeline is working as intended and is explicitly out of scope for this epic. Sorting affects only the **display order within each column** after tasks are already assigned to their status.

Key files:
- [`src/server/settings-manager.ts`](src/server/settings-manager.ts): extend `Settings` and `DEFAULT_SETTINGS` with a default such as `idAsc`.
- [`src/client/types.ts`](src/client/types.ts): add the shared client type, plus a pure helper like `sortTasks(tasks, taskColumnSort)` that sorts a copy of a task list by `updatedAt` or numeric `id`.
- [`src/client/hooks/useRalph.ts`](src/client/hooks/useRalph.ts): update fallback `DEFAULT_SETTINGS` to match the server default.
- [`src/client/components/LoopConfigSection.tsx`](src/client/components/LoopConfigSection.tsx): add a select control labeled `Task Column Sort` with options for last edit ascending/descending and id ascending/descending.
- [`src/client/App.tsx`](src/client/App.tsx): apply the helper to each `groups[col.key]` list before rendering its column, using the single shared setting value.
- [`src/client/types.test.ts`](src/client/types.test.ts): add focused unit tests for all sort modes and verify the helper does not mutate the input array.

Implementation shape:
```ts
export type TaskColumnSort = "updatedAtAsc" | "updatedAtDesc" | "idAsc" | "idDesc";
```

Behavior:
- `updatedAtAsc`: oldest edited tasks first within each column.
- `updatedAtDesc`: most recently edited tasks first within each column.
- `idAsc`: lowest task id first.
- `idDesc`: highest task id first.
- All task-status columns use the same selected sort metric and direction; sorting does not change which column a task belongs to.
- Persisted task order and server-side next-task selection stay unchanged; only the client’s displayed row order within each column may differ.
- **No edits** to task progression / status-transition logic (`backlog` → `inProgress` → `inQa` → `done`, refresh, sync, loop picks “next” task, etc.).

Verification:
- Run `npm test -- src/client/types.test.ts` or the repo’s equivalent Vitest command.
- Run `npm run typecheck` if time permits after implementation.