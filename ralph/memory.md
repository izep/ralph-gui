# Project Memory

This file is maintained by the Ralph loop. Each plan, dev, and QA phase reads it for context and appends new discoveries.

Keep entries concise and non-obvious. Remove entries that are no longer relevant.

## Commands

- Focused Vitest file: `npm test -- src/client/types.test.ts` (uses `vitest --config config/vitest.config.ts` from package.json).
- Full suite (CI style): `npm run test:ci`.

## Conventions

- Persisted settings: extend `Settings` and `DEFAULT_SETTINGS` in `src/server/settings-manager.ts`, mirror the same fields on `Settings` in `src/client/types.ts`, and keep the fallback object in `src/client/hooks/useRalph.ts` in sync (see comment there). New `DEFAULT_SETTINGS` keys are picked up by `RalphLoop.bootstrap` when it writes initial `ralph/settings.json`.
- Client tests for shared helpers live in colocated `*.test.ts` files (e.g. `src/client/types.test.ts`).

## Gotchas

- Task column display order: `taskColumnSort` is persisted on `Settings` (default `idAsc`). `LoopConfigSection.tsx` exposes **Task Column Sort**; `App.tsx` passes `sortTasks(groups[col.key] || [], settings.taskColumnSort)` into each column so only visible row order changes; merge-on-read fills the key for older `settings.json` files.

- If `npm run typecheck` fails with TS2688 (cannot find type definition file for `node`), ensure `@types/node` is installed (`package.json` lists it in devDependencies; run `npm install` after clone).

- `sortTasks` lives in `src/client/types.ts`; ISO `updatedAt` ordering uses `localeCompare` (lexicographic order matches chronological order for standard ISO-8601 strings).

- `groupTasks` in `src/client/types.ts` routes `blocked` tasks into the `inProgress` column (no separate Blocked column). The `COLUMNS` constant only defines four columns (backlog, inProgress, inQa, done).

- `TaskManager.setTaskStatus` automatically deletes `t.blocked` when transitioning away from `blocked` status. `TaskManager.resolveBlocker` bypasses this by stamping `resolved`/`resolvedAt` on the blocked object first, then removing and re-inserting the task at the end of the current backlog entries (stable ordering).

- Server HTTP endpoints live in `src/server/index.ts`; all mutating task endpoints should check `loop.isRunning` and return 409 if the loop is active to prevent race conditions.

- Blocker resolved fields: the `blocked` sub-object includes optional `resolved?: boolean` and `resolvedAt?: string` in both client and server task types. `POST /api/tasks/:id/resolve-blocker` is the endpoint; it delegates to `RalphLoop.resolveBlocker` which calls `TaskManager.resolveBlocker`.

- `TaskCard.tsx` uses local `resolving` state to disable the checkbox while the resolve-blocker fetch is in-flight; the WebSocket push handles the task disappearing from the blocked view after success (no optimistic mutation).