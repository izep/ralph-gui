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

## 2026-05-21 Epic 004 Plan Survey

- All Epic 003 tasks (IDs 1–15) are fully done. task-status.json max ID is 15; Epic 004 tasks use IDs 16–26.
- Epic 004 starting state: Dockerfile is copilot-only (no INSTALL_* build args); docker-compose.agents.yml has no build args and no non-Copilot auth env vars; no docker-pool.ts; no dockerPoolSize/dockerParallelTasks/dockerMountSocket/dockerInstalledBackends in settings; LLMCaller has single currentProcess (no per-slot map); git-manager has no worktree helpers; ralph-loop is sequential.
- buildDockerSpawn currently takes (composeFile, service, command, commandArgs) with no containerIndex/worktreeCwd params — extend with opts param in Task 20.
- LLMCallOpts in llm-caller.ts currently has: fleetMode?, useDocker?, dockerComposeFile?, dockerService? — extend with dockerContainerIndex?, dockerWorktreeCwd? in Task 22.
- Implementation order: 16 (Dockerfile/compose) → 17 (validate multi-CLI) → 18 (settings pool UI) → 19 (socket mount) → 20 (docker-pool.ts + --index) → 21 (git worktrees) → 22 (parallel LLMCaller) → 23 (parallel loop) → 24 (tests) → 25 (docs) → 26 (stretch plan parallel).
- docker-compose.agents.yml socket mount: use DOCKER_SOCKET env var with /dev/null fallback to avoid compose failures when socket is disabled; alternatively use compose profiles.
- Worktree host path: <repoRoot>/.ralph/worktrees/slot-<n>; container path: /workspace/.ralph/worktrees/slot-<n>.

- Discovery 2026-05-21: docker/Dockerfile and docker-compose.agents.yml already include INSTALL_* build args (INSTALL_COPILOT, INSTALL_CLAUDE, INSTALL_GEMINI, INSTALL_CURSOR, INSTALL_DOCKER_CLI) and the non-Copilot auth env vars (ANTHROPIC_API_KEY, GEMINI_API_KEY, CURSOR_API_KEY, CURSOR_SESSION_TOKEN). No edits were required for this task.
- Validation tip: run `docker compose -f docker-compose.agents.yml config` to confirm build args and envs are present, and `npm run typecheck` to ensure TS unchanged.
- Note: Running `npm run typecheck` revealed three TS errors in `src/server/docker-pool.test.ts` related to overly-specific tuple typings on mock.calls; tests (not code) need typing fixes to pass CI. This is unrelated to the Dockerfile/compose changes but blocks a clean typecheck until addressed.

## 2026-05-21 Test typing fixes

- While enabling plan-phase parallel dispatch, several Vitest test files contained untyped mock usages that TypeScript flagged (e.g. accessing `.mock` on functions, implicit any parameters in mock classes). To keep CI green, tests were updated with minimal typing/casts:
  - Added explicit types to the MockDockerPool class in `src/server/ralph-loop.test.ts`.
  - Replaced bare `fs.existsSync?.mockReset`/`mockReturnValue` calls with `(fs.existsSync as any)?.mockReset()` casts in `src/server/docker-runner.test.ts`.
  - Provided typed mockResolvedValue payloads where required by the mocked function signatures.

These are test-only changes to satisfy the TypeScript compiler; production server code was not modified.


## 2026-05-21 Epic 004 Mid-Sprint Survey

- Tasks 17–23 and 25 are all fully implemented outside the loop; task-status.json still shows them as `backlog` (loop never ran to mark them done). Verify before re-implementing by checking docker-runner.ts, docker-pool.ts, git-manager.ts, llm-caller.ts, ralph-loop.ts, DockerSection.tsx, and both README files.
- Two test scenarios from the epic spec are absent (Task 24 gap):
  1. `docker-runner.test.ts`: `validateSocketMount: true` path — needs `vi.spyOn(fs, 'existsSync')` (or `vi.mock('fs', ...)`) since `existsSync` is imported from `'fs'` in docker-runner.ts. Two cases: socket file missing → ok:false; docker info + compose version both succeed → ok:true.
  2. `ralph-loop.test.ts`: parallel dispatch when `dockerParallelTasks: true` + `dockerPoolSize: 2` — mock `ensureDockerPool` from `'./docker-pool.js'` to resolve, mock LLMCaller.call, assert both dev calls start concurrently before either resolves.
- `fs.existsSync` in docker-runner.ts is already imported as a named import; mock it with `vi.spyOn(fsModule, 'existsSync')` after importing `* as fsModule from 'fs'` in the test.

## 2026-05-21 QA update

- Verified: both Epic 004 test scenarios are present and passing. Ran `npm run test:ci`; the full suite succeeded (245 tests).
 - src/server/docker-runner.test.ts: `ensureDockerAgentRunning — validateSocketMount` exercises host-socket-missing and socket-present flows by mocking `fs.existsSync` and container `docker info` / `docker compose version` execs.
 - src/server/ralph-loop.test.ts: `RalphLoop parallel dispatch` exercises parallel dev/QA runs with `useDocker: true`, `dockerPoolSize: 2`, and `dockerParallelTasks: true`; DockerPool and GitManager are mocked and concurrency is asserted.

Note: Tests use mocked `child_process.spawn` and do not require a Docker daemon; CI remains Docker-free for these cases.


## 2026-05-21 Epic 004 Task 26 (Plan Parallel) Implementation

- `dockerPlanParallel: boolean` (default `false`) added to all three settings layers (settings-manager.ts, client/types.ts, useRalph.ts fallback). Mirrors the pattern for all other docker* settings.
- Pool initialization in `ralph-loop.ts start()` now triggers on `poolSize > 1 && (dockerParallelTasks || dockerPlanParallel)` — previously only `dockerParallelTasks` triggered it; plan-parallel also needs the pool.
- `parseResearchPrompts(content)` in `parse-output.ts` extracts `<research-prompt>...</research-prompt>` blocks; returns an empty array (no-op) when blocks are absent.
- Plan parallel dispatch in `runLoop()` runs AFTER backlog sync, acquires a pool slot per prompt, dispatches each via `LLMCaller.call()` with `dockerContainerIndex` + `dockerWorktreeCwd`, then `Promise.all`s all sub-jobs and merges any JSON task lists from their outputs into the backlog.
- Vitest mock accumulation gotcha: `vi.spyOn` on an already-spied method in a later `it()` block may return the same spy instance, preserving `mock.calls` from earlier tests. Use `spy.mockClear()` after creating the spy in tests that must start with a clean call history.
- DockerSection.tsx: "Parallel plan research (stretch)" checkbox is disabled when `dockerPoolSize <= 1`, same pattern as "Run backlog tasks in parallel".

## 2026-05-21 Epic 004 Final Survey

- All Epic 004 tasks (IDs 16–26) are fully implemented. npm run test:ci passes (249 tests); npm run typecheck passes.
- task-status.json still shows tasks 17–23 and 25 as "backlog" (implemented outside the loop before it could mark them done) but the implementation is complete.
- Optional: scripts/docker-pool-smoke.mjs was not created; manual Docker smoke steps are documented inline in docker/README.md (not as a standalone script). This is acceptable per the epic spec (optional).
- Epic 004 is complete; no remaining backlog items.

## 2026-05-22 Epic 004 Phase 5 Plan Survey

- Phase 5 (Control Panel UX) is fully unimplemented: no CollapsibleSection.tsx, no control-panel-dirty.ts, no dirty detection, no per-section Save/Reset in any section component.
- ControlPanel.tsx (186 lines) has a single `handleSaveSettings` that saves ALL settings (Docker + Loop) together via `onSaveSettings`; no dirty checks; Save button always enabled.
- Task IDs 27–30 cover Phase 5: collapsible sections (27), dirty helpers + footers (28), split Docker/Loop save wiring (29), component tests + README note (30).
- `pickDockerSettings` should include: useDocker, dockerComposeFile, dockerService, dockerIsolateBranch, dockerPoolSize, dockerParallelTasks, dockerMountSocket, dockerInstalledBackends. Exclude epicBaseBranch, dockerWorkBranch (read-only metadata).
- Dirty comparison: JSON.stringify on sorted keys is sufficient (no lodash in package.json — check before importing).
- After Save, the saved baseline must update (store returned/saved settings) so the dirty flag resets without requiring a server roundtrip.
- epicFile path changes must be persisted on Save epic (currently handleSaveEpic only calls onSaveEpic for content; path goes through handleSaveSettings for Loop — after split, epic save handler must also call onSaveSettings for the epicFile field).

## 2026-05-22 UI Updates

- Added CollapsibleSection component (src/client/components/CollapsibleSection.tsx) and wired Collapse all / Expand all toolbar in ControlPanel.tsx. Wrapped Docker, Loop, Epic and Prompts sections and hid duplicate headers by adding a suppressHeader prop to each section component. Tests updated to expect single section headings; all tests and typecheck pass.

## Control panel dirty detection (Phase 5)

- `src/client/control-panel-dirty.ts` exports `pickDockerSettings`, `pickLoopSettings`, `isDockerDirty`, `isLoopDirty`. Uses `stableStringify` (sorted keys) for deep comparison — no lodash needed.
- Docker fields: `useDocker`, `dockerComposeFile`, `dockerService`, `dockerIsolateBranch`, `dockerPoolSize`, `dockerParallelTasks`, `dockerMountSocket`, `dockerInstalledBackends`, `dockerPlanParallel`. Everything else is a loop field.
- `ControlPanel.tsx` computes dirty booleans directly from props `settings` (server baseline) vs `localSettings` (draft). No saved-baseline state needed — WS broadcast updates `settings` prop after save, which clears dirty via `useEffect`.
- `handleSaveDocker`: merges `pickDockerSettings(localSettings)` into server `settings` before calling `onSaveSettings` — prevents unsaved loop draft from being lost.
- `handleSaveLoop`: same pattern with `pickLoopSettings`; updates `savedModelsByBackend` in the merge.
- Section footer CSS: `.section-footer` in `App.css` — flex row, top border, 12px gap/padding.
- Tests: `getByLabelText(/pool size/i)` is the correct query for the docker pool size input (label is "Pool size"); `getByDisplayValue("1")` is ambiguous because other number fields share value 1.

## 2026-05-24 Epic 004 Final Verification

- Full suite: 265 tests pass (npm run test:ci). All Phase 5 (Control Panel UX) items fully implemented and tested:
  - CollapsibleSection.tsx, control-panel-dirty.ts, per-section Save/Reset footers in DockerSection, LoopConfigSection, EpicSection, PromptsSection, ControlPanel collapse/expand all wiring, App.css collapsible styles.
  - README.md documents collapsible panel UX (line ~179).
- Epic 004 is fully complete — all 14 epic-level todos and all task IDs 26 are done.16

## 2026-05-24 Plan Survey

- All Epic 004 tasks (IDs 16-30) are fully implemented: Dockerfile build args, compose auth env vars, dockerMountSocket + nested compose validation, docker-pool.ts, git worktrees, parallel LLMCaller, parallel ralph-loop, dockerPlanParallel stretch, CollapsibleSection, control-panel-dirty.ts, per-section Save/Reset footers, split Docker/Loop save, component tests, docs.
- Fixed test gap: `ralph-loop.test.ts` docker-runner mock was missing `resolveDockerSocketPath` export (added after mock was written); caused 3 test failures. Fix: add `resolveDockerSocketPath: vi.fn(() => "/var/run/docker.sock")` to the `vi.mock("./docker-runner.js", ...)` factory.
- npm run test:ci passes 265 tests; npm run typecheck passes. Epic 004 is complete.

## Epic 004 Phase 2c — merge-back implementation gaps (identified 2026-06-04)

- `mergeWorktreeBranch(slot, baseBranch, _targetBranch)` in `git-manager.ts` ignored `_targetBranch`; it now checks out `targetBranch` before merging so slot merges land on the intended work branch.
- Parallel dev/QA and plan-parallel paths in `ralph-loop.ts` previously passed raw `epicBase` to `createWorktree`; these paths now compute `worktreeBase = settings.dockerWorkBranch || epicBase` and use that for `createWorktree`, producing slot branches like `ralph/epic-foo-slot-0` when `dockerWorkBranch` is set.
- Updated tests: unit tests in `src/server/git-manager.test.ts` and `src/server/ralph-loop.test.ts` were adjusted/mocked as needed and all pass locally.
- Remaining follow-ups: add `autoCommit` cwd arg for worktree commits and wire `dockerAutoMergeEpicWork` into `finishRun` (planned next).
- Verified on 2026-06-04: code already contains these fixes; full test suite passed locally (274 tests).

## 2026-06-04 Plan Survey — Epic 004 Phase 2c follow-up tasks

- Remaining backlog tasks (IDs 29-32) cover: worktree-aware `autoCommit` (cwd arg), `dockerAutoMergeEpicWork` setting + `finishRun` auto-merge, DockerSection UI checkbox + README docs, and tests for all of the above.
- `git-manager.ts` `autoCommit(taskNum, title)` does NOT yet accept a `cwd` parameter — must be added for parallel worktree commits to land on the slot branch.
- `settings-manager.ts` and `client/types.ts` do NOT yet have `dockerAutoMergeEpicWork` — add with default `true`.
- `control-panel-dirty.ts` `DOCKER_KEYS` must include `'dockerAutoMergeEpicWork'` once the setting is added.
- `finishRun` in `ralph-loop.ts` is currently synchronous and has no auto-merge logic; must be carefully extended (or an async pre-step added) without breaking the existing try/finally run structure.
- Phase 5 (collapsible sections, dirty Save/Reset) is fully complete as of 2026-05-24 (265 tests pass).

## 2026-06-04 Implementation: worktree-aware autoCommit

- Implemented: `GitManager.autoCommit(taskNum, title, cwd?)` accepts an optional host-side cwd so commits run inside a slot worktree when provided. Internally `runGit` gained an optional `cwd` parameter and uses `cwd ?? this.repoRoot` for spawn.
- `RalphLoop.autoCommitTask` updated to accept `worktreeCwd?: string` (container path). When `worktreeCwd` is provided and starts with `/workspace`, it is mapped to the host path under `repoRoot` (e.g. `/workspace/.ralph/worktrees/slot-0` -> `<repoRoot>/.ralph/worktrees/slot-0`) and passed to `gitManager.autoCommit`.
- `runDevQALoop` now forwards `slotOpts?.worktreeCwd` into `autoCommitTask` so parallel Docker tasks auto-commit inside their slot worktree.
- Validation: `npm run typecheck` passed locally after changes.

## 2026-06-04 Epic 004 Phase 2c — dockerAutoMergeEpicWork implemented

- `dockerAutoMergeEpicWork: boolean` (default `true`) added to all three settings layers (settings-manager.ts, client/types.ts, useRalph.ts fallback).
- `DOCKER_KEYS` in `control-panel-dirty.ts` includes `'dockerAutoMergeEpicWork'` so it is included in docker dirty detection and saved with Save Docker.
- `autoMergeOnFinish(runId)` is a private async method on RalphLoop; it is called from the `runPromise.then()` chain (between runLoop completing and finishRun). Kept finishRun synchronous to avoid callers needing to await it.
- Auto-merge guard conditions: `useDocker && dockerIsolateBranch && dockerAutoMergeEpicWork && epicBaseBranch && dockerWorkBranch && epicBaseBranch !== dockerWorkBranch`. Also checks `stopRequestedRunId === runId` to skip on stop.
- DockerSection.tsx: auto-merge checkbox shown only when `dockerIsolateBranch` is true (same visibility gate pattern as other isolation-dependent fields).
- git-manager.test.ts uses the same real-git-in-tmpDir pattern for autoCommit+cwd and mergeWorktreeBranch checkout tests.
- ralph-loop.test.ts auto-merge tests: spy accumulation gotcha — call `mergeWorkSpy.mockClear()` after spying in "skips" tests, since vi.spyOn on a prototype may return the same spy instance with call count preserved from earlier tests in the same describe block.
- Full suite: 284 tests pass; typecheck passes. Epic 004 is complete.

## 2026-06-04 — Auto-merge setting implemented

- Added `dockerAutoMergeEpicWork` setting (default: true) and `autoMergeOnFinish` helper in `src/server/ralph-loop.ts`.
- On successful loop completion (not stopped, no error) and when `useDocker && dockerIsolateBranch` are true, the loop now checks out `epicBaseBranch` and attempts a `--no-ff` merge of `dockerWorkBranch` into it. Conflicts are logged and do not throw.
