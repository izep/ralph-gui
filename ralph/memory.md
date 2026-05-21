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

- Epic 003 state (surveyed 2026-05-20): fleet mode, Docker, git merge-back, and Epic Set button are ALL unimplemented. task-status.json starts empty. All 10 tasks are new (IDs 1–10).

- `LLMCaller.call()` resolves backend command once and caches it per backend in `cachedCommands`; `clearCommandCache()` is exposed for tests. The `effectiveAgentBackend()` helper checks `RALPH_AGENT_BACKEND_OVERRIDE` env var first.

- `LLMCallOpts` (aliased as `CopilotOpts`) is the options bag for `LLMCaller.call()`; extend it when adding fleet/docker opts rather than adding new parameters.

- Fleet prefix: only apply `applyCopilotFleetPrefix` inside the `copilot` branch of the backend switch — never for other backends even if `fleetMode` is true in settings (defense in depth).

- Docker bind-mount uses `RALPH_REPO_ROOT` env var in compose; ralph-loop must set this env var when spawning docker compose exec so the correct host path is mounted to `/workspace`.

- `resolveComposeFile` packageRoot can be computed from `new URL('../..', import.meta.url).pathname` (two levels up from `src/server/docker-runner.ts`) to reach the repo root where `docker-compose.agents.yml` lives.

- git-manager tests should use a real temp git repo (mkdtemp + git init) to avoid complex spawn mocks; see existing task-manager tests for the mkdtemp pattern.

- `EpicFileDialog.tsx` must use CSS classes from App.css only (no inline styles, no external lib). Inspect existing modal patterns in ErrorBanner.tsx for the overlay/modal structure if present.

## 2026-05-20 Updates

- Fleet core implemented: added `FLEET_CAPABLE_BACKENDS`, `backendSupportsFleetMode`, `effectiveFleetMode`, and `applyCopilotFleetPrefix` in `src/server/llm-caller.ts`.
- Settings synced: `fleetMode: boolean` added to `Settings` and `DEFAULT_SETTINGS` (`src/server/settings-manager.ts`), mirrored in `src/client/types.ts`, and the client fallback in `src/client/hooks/useRalph.ts`.
- Tests updated to include `fleetMode` in test defaults (`src/client/components/components.test.tsx`).
- Ran `npm run typecheck` locally; the TypeScript build passed after these edits.

Note: keep `applyCopilotFleetPrefix` usage restricted to the `copilot` backend only (defense in depth).
- Added fleet helpers (FLEET_CAPABLE_BACKENDS, backendSupportsFleetMode, effectiveFleetMode, applyCopilotFleetPrefix), fleetMode in settings/types; typecheck passed.
- UI: LoopConfigSection now includes a Fleet mode checkbox (persisted via settings); it is disabled when the selected backend is not fleet-capable. Server: ralph-loop forwards settings.fleetMode to LLMCaller for dev and QA calls only.
- Running `npm test` launches Vitest in watch mode by default in this repo; use `npm run test:ci` for a single-run CI-style test execution or stop the watcher after the run when automating.

## 2026-05-20 Epic 003 Implementation Notes

- Docker runner (`src/server/docker-runner.ts`): `checkDockerHost()` probes in order: CLI installed (ENOENT/code 127) → daemon running (docker info) → compose available (docker compose version). Each returns a typed `DockerHostCheck` with `reason` + `message`.
- `resolveComposeFile` uses `PACKAGE_ROOT = path.resolve(__dirname, "../..")` (two levels up from `src/server/`) to find bundled `docker-compose.agents.yml` at repo root.
- `LLMCallOpts` extended with `useDocker`, `dockerComposeFile`, `dockerService`; when `useDocker` is true, `LLMCaller.call()` wraps the backend spawn with `buildDockerSpawn()` and sets `RALPH_REPO_ROOT` env var.
- Settings extended with `useDocker`, `dockerComposeFile`, `dockerService`, `epicBaseBranch`, `dockerWorkBranch`, `dockerIsolateBranch`. All three layers (settings-manager.ts, client/types.ts, useRalph.ts fallback) were updated simultaneously.
- `ralph-loop.start()` checks Docker host and captures/creates epic branch before starting the loop; fails fast with clear error messages for detached HEAD or Docker issues.
- `GitManager` extended with `createOrCheckoutBranch`, `mergeWorkBranch`, `getBranchAheadBehind`, `deleteLocalBranch`.
- New API endpoints in index.ts: `POST /api/epic/set-file`, `POST /api/epic/create-file`, `POST /api/docker/validate`, `GET /api/docker/status`, `GET /api/git/branch-status`, `POST /api/git/merge-epic-work`.
- `buildReadiness()` now includes `dockerHostOk`/`dockerHostError` fields when `settings.useDocker` is true.
- EpicSection: Set button inline with the Epic File input. When file not found, opens an inline `EpicFileDialog` (not a separate file — the dialog component is defined in the same file for co-location).
- Modal CSS: `.cp-modal-overlay`, `.cp-modal`, `.cp-modal__title`, `.cp-modal__body`, `.cp-modal__actions` added to App.css.
- git-manager tests use a real temp git repo (`mkdtemp + git init + execSync`) without spawn mocks — cleaner for git integration tests. The `git()` helper uses `execSync` with stdio pipe.
- docker-runner tests mock `child_process.spawn` via `vi.hoisted`; use `vi.waitFor` to sequence async mock events.
- All 183 tests pass after changes.

## 2026-05-20 Epic 003 Plan Survey (tasks 4-10 state)

- Tasks 4-10 are fully implemented in the codebase (docker-compose.agents.yml, Dockerfile, docker/README.md, docker-runner.ts, DockerSection.tsx, EpicSection with EpicFileDialog, git-manager extensions, all API endpoints in index.ts, CLI args in cli-args.ts, README Docker/fleet sections).
- task-status.json shows these as "backlog" because they were implemented outside the loop before it could mark them done. Do NOT re-implement; mark them done and move to the actual remaining gap.
- Remaining gap (task 11): component behavioral tests — DockerSection Set Docker button calling `onValidateDocker`, EpicSection Set button calling `onSetEpicFile`, not-found dialog appearing, Create button calling `onCreateEpicFile`. The existing 28 component tests only cover renders and the fleet checkbox; API-call assertions are missing.
- Mock prop types already wired in ControlPanel.tsx: `onValidateDocker`, `onMergeEpicWork`, `onSetEpicFile`, `onCreateEpicFile`. Use `vi.fn()` spy variants in the new tests; the `renderPanel` helper passes noop versions; create separate render calls with spy mocks.
- QA note: Verified component behavioral tests for DockerSection 'Set Docker' and EpicSection 'Set' dialog are present in `src/client/components/components.test.tsx` and pass. Ran `npm run test:ci` — Vitest reported 187 tests passing.
## 2026-05-20 Plan Survey — agent-model-dropdowns remaining

- **`src/shared/agent-models.ts` exists** (Task 12 core deliverable). Catalog has all backend IDs + `preferredFor` + helpers; strength/tier/multiplier/yolo/fleet are empty strings — **valid for v1** (metrics live in `docs/coding-agents-available-models.md`).
- **Task 12 thrashing:** 32+ dev iterations because (a) dev re-ran “create file” without checking disk, (b) dev output lacked `<status>done</status>`, (c) task spec implied full markdown metadata in TS, (d) no `agent-models.test.ts` for QA to latch onto. **Fix:** verify-or-create + add tests + see revised Task 12 in `docs/epics/epic-003-docker-container.plan.md` and `ralph/epic.md`.
- LoopConfigSection.tsx now uses AGENT_MODEL_CATALOG dropdowns with a Custom option and a 'View models' link; preferred defaults auto-applied on backend change.
- `/models-reference` route absent from index.ts — **Task 14**.
- `docs/coding-agents-available-models.md` exists with 4 platform sections.
- Shared catalog must NOT import `src/client/types.ts`; duplicate `AgentBackendId` locally (already done in agent-models.ts).
- PREFERRED defaults: copilot→gpt-5.4/gpt-5.4-mini/gpt-5.4-mini; cursor-agent→claude-sonnet-4.6/gpt-5-mini/gpt-5-mini; claude→claude-sonnet-4.6/claude-haiku-4.5/claude-haiku-4.5; gemini→gemini-2.0-auto/gemini-2.0-flash/gemini-2.0-flash.
- Tasks 13–15: dropdown UI, routes, extra tests. **Do not re-implement Task 12 catalog** unless tests fail.

## Task 12 verification (run before another dev pass)

```bash
npm run typecheck
npm run test:ci -- src/shared/agent-models.test.ts   # create this file if missing
```

If both pass and `agent-models.ts` exports match epic checklist → mark Task 12 done; proceed to Task 13.

- 2026-05-20: agent-models module at src/shared/agent-models.ts exists; npm run typecheck passed after verification.

## 2026-05-20 Epic 003 Tasks 14-15 Completion

- `GET /models-reference?backend=<id>` route added to index.ts; HTML rendering extracted to `src/server/models-reference.ts` (`buildModelsReferenceHtml`) for direct testability — no supertest needed.
- `GET /api/agent-models?backend=<id>` returns JSON catalog + preferred defaults for the given backend.
- Server tsconfig updated to include `../shared/agent-models.ts` (not the test file) to avoid nodenext `.js` extension requirement on test imports.
- `buildModelsReferenceHtml` falls back to copilot catalog AND copilot preferred models for unknown backend IDs.
- Component tests added to `components.test.tsx`: LoopConfigSection renders copilot options, auto-applies preferred models on backend switch, View models link calls window.open with correct URL.
- All 201 tests pass; typecheck passes.
