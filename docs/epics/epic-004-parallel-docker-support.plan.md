---
name: Epic 004 — Parallel Docker agents, control panel UX
overview: Docker agent stack (multi-CLI build args, pool, worktrees, nested compose socket), end-to-end git merge-back (parallel slot merges, loop-end auto-merge to epic base branch), control panel collapsible sections with dirty-aware Save/Reset, document and test all of the above.
todos:
  - id: dockerfile-build-args
    content: Add INSTALL_* build args to docker/Dockerfile; wire args + all auth env vars in docker-compose.agents.yml
    status: pending
  - id: validate-installed-clis
    content: Extend docker-runner validate to probe each installed backend CLI; document rebuild flow in docker/README.md
    status: pending
  - id: settings-pool
    content: Add dockerPoolSize, dockerParallelTasks, dockerInstalledBackends to settings + DockerSection UI
    status: pending
  - id: docker-pool-module
    content: "Create docker-pool.ts: scale compose service, list containers, acquire/release slots, buildDockerSpawn --index"
    status: pending
  - id: git-worktrees
    content: GitManager worktree helpers per slot; per-slot cwd for docker exec -w
    status: pending
  - id: llm-caller-parallel
    content: LLMCaller multi-process map + dockerContainerIndex/dockerWorktreeCwd opts
    status: pending
  - id: parallel-dev-qa
    content: "ralph-loop: parallel runDevQALoop up to pool size with TaskManager write mutex"
    status: pending
  - id: plan-pool-stretch
    content: (Stretch) Plan prompt parse + dispatch parallel sub-jobs to pool behind dockerPlanParallel flag
    status: pending
  - id: docs-readme-updates
    content: Update README.md and docker/README.md for build args, pool size, parallel tasks, worktrees, validate, and troubleshooting
    status: pending
  - id: tests-docker-pool
    content: Add/extend unit and integration tests (docker-pool, buildDockerSpawn --index, parallel LLMCaller, worktrees); optional CI smoke script for real Docker
    status: pending
  - id: docker-socket-nested-compose
    content: Optional Docker socket mount + docker/compose CLI in agent image; validate nested docker info; settings + docs for target-project compose/E2E tasks
    status: pending
  - id: collapsible-sections
    content: CollapsibleSection wrapper; collapse/expand all in ControlPanel header; wrap Docker, Loop Config, Epic, Prompts
    status: pending
  - id: dirty-save-reset
    content: Per-section dirty detection; Save disabled until dirty; Reset rolls back draft; Save/Reset footers below section fields
    status: pending
  - id: docker-section-save
    content: Split Docker settings save from Loop Config (Save Docker + save handler for docker* fields only)
    status: pending
  - id: tests-control-panel-ux
    content: components.test.tsx for collapse all, dirty Save disabled, Reset restores draft, save button placement
    status: pending
  - id: git-merge-back-parallel
    content: Fix parallel worktree base (dockerWorkBranch), mergeWorktreeBranch checkout target, slot branch naming
    status: pending
  - id: worktree-auto-commit
    content: Run autoCommit in slot worktree cwd when parallel Docker dev/QA uses worktreeCwd
    status: pending
  - id: auto-merge-epic-work
    content: dockerAutoMergeEpicWork setting (default true); shared merge helper; call from finishRun on successful loop end
    status: pending
  - id: merge-back-ui-docs
    content: DockerSection auto-merge checkbox; README/docker/README three-layer branch flow and troubleshooting
    status: pending
  - id: tests-merge-back
    content: git-manager + ralph-loop tests for checkout-before-merge, worktree base, loop-end auto-merge and conflicts
    status: pending
isProject: false
---

# Epic 004 — Parallel Docker agents and control panel UX

**Canonical plan:** [docs/epics/epic-004-parallel-docker-support.plan.md](epic-004-parallel-docker-support.plan.md) — **all** future scope, design changes, and todos for this epic are edited in this file only (not separate Cursor plan files).

**Depends on:** [Epic 003 — Docker container agents](epic-003-docker-container.plan.md) (single-container Docker transport, `epicBaseBranch` / `dockerWorkBranch` capture, manual `merge-epic-work` API, `docker-runner.ts`, `LLMCaller` docker wrapper). Epic 004 completes parallel worktree merge-back and loop-end auto-merge into `epicBaseBranch`.

## Goal

1. Build the agent Docker image with **selectable coding-agent CLIs** via Dockerfile **build args** (not Copilot-only).
2. Run **more than one agent container** at a time, with pool size **N configurable in `ralph/settings.json`**.
3. Execute **parallel dev/QA backlog tasks** in separate containers using **git worktree** isolation (minimum viable parallelism).
4. *(Stretch)* Let the **planning agent** dispatch parallel sub-jobs into the container pool; aggregate results before dev picks up tasks.
5. **Document** the new Docker patterns in project README files so operators can build images, size the pool, and troubleshoot without reading source.
6. **Test** the Docker pool pattern end-to-end (automated unit/integration tests plus an optional real-Docker smoke path).
7. Allow **agent containers to run Docker Compose inside the target repo** (nested compose / “Docker-outside-of-Docker” via host socket) so dev tasks like “start full stack + run E2E pytest” are not blocked when Ralph uses `useDocker`.
8. Improve **Settings control panel UX**: collapsible sections (Docker Agents, Loop Configuration, Current Epic, Prompts), **Collapse all / Expand all**, per-section **Save** (disabled until dirty) and **Reset** (revert unsaved edits), with Save/Reset controls **below** the fields they affect.
9. **Complete git merge-back** for Docker epics: parallel slot branches merge into the work branch per task; when the loop finishes successfully, merge the work branch into **`epicBaseBranch`** (the branch checked out at loop start) by default, with opt-out and manual retry (extends [Epic 003](epic-003-docker-container.plan.md) merge-back).

## Motivation — blocked target-project tasks

Real example (target repo backlog): **“E2E harness test against compose stack”** — agent must run:

```bash
docker compose -f docker/docker-compose.yml up -d --build
RUN_E2E_TESTS=1 pytest tests/e2e -v -m e2e
```

When the coding agent runs **inside** `ralph-agent` without Docker privileges, `docker compose up` fails with errors like *cannot create containers / mount namespaces*. Ralph records the task as **blocked** even though the **host** has Docker installed.

Today’s flow only uses the host daemon to **exec into** `ralph-agent`; the agent CLI does **not** get a working Docker client for the mounted `/workspace` project.

```mermaid
flowchart TB
  Host[Host Docker daemon]
  Ralph[Ralph server on host]
  Agent[ralph-agent container]
  TargetStack[target project compose services]

  Ralph -->|"compose exec"| Agent
  Agent -.->|"broken today"| TargetStack
  Host --> Agent
  Agent -->|"needs socket + CLI"| Host
  Host --> TargetStack
```

## Decisions (locked in)

| Topic | Choice |
|-------|--------|
| Image strategy | **Build args** — `INSTALL_COPILOT`, `INSTALL_CLAUDE`, `INSTALL_GEMINI`, `INSTALL_CURSOR` (default Copilot `true`, others `false`) |
| Parallelism scope (v1) | **Dev + QA only** across backlog items; **plan phase stays sequential** until stretch phase |
| Isolation model | **Git worktrees** per pool slot under `<repoRoot>/.ralph/worktrees/slot-<n>`; same `.git` object store as host bind-mount |
| Pool sizing | `dockerPoolSize` in settings (default `1`, capped e.g. at `8`) |
| Parallel toggle | `dockerParallelTasks` — enable parallel backlog execution when `dockerPoolSize > 1` |
| Exec targeting | `docker compose exec --index <n>` per slot (requires recent Compose plugin) |
| Fleet vs pool | **Complementary** — Copilot `/fleet` is in-container subagents; pool is multiple containers for different backlog tasks |
| Stretch plan dispatch | Behind `dockerPlanParallel` (default off), requires pool infrastructure from Phase 2 |
| Nested compose (target repo) | **Opt-in** `dockerMountSocket` (default `false`); mount host `docker.sock`, install **Docker CLI + Compose plugin** in agent image when `INSTALL_DOCKER_CLI=true` |
| Nested compose security | Document that socket mount grants effective **host Docker access**; never enable in untrusted multi-tenant images |
| Sandboxed CI | If the **host** forbids container creation (no socket, no privileges), task stays blocked — document “run on Docker-capable runner” (same as current `blocked.needs`) |
| Control panel sections | **Repository** stays always visible (not collapsible); **Docker Agents**, **Loop Configuration**, **Current Epic**, **Prompts** are collapsible |
| Save granularity | **Docker** settings save separately from **Loop** settings (today both share one “Save Settings” in Loop Config) |
| Dirty / Reset | Compare local draft to last **saved** server state per section; Reset restores draft from props, does not call API |
| Merge into starting branch | **Default on** at successful loop end: merge `dockerWorkBranch` → `epicBaseBranch` when `dockerIsolateBranch` and both branches are set. Setting **`dockerAutoMergeEpicWork`** (default `true`) disables auto-merge. Manual **Merge work into epic branch** unchanged. On conflict: do not auto-resolve; log + surface in UI (same as Epic 003 API). Skipped when isolation off (commits already on `epicBaseBranch`). |

## Current state (after Epic 003)

- [`docker/Dockerfile`](../../docker/Dockerfile) installs only `@github/copilot`.
- [`docker-compose.agents.yml`](../../docker-compose.agents.yml) defines a **single** `ralph-agent` service; Ralph always `docker compose exec`s into one container ([`buildDockerSpawn`](../../src/server/docker-runner.ts)).
- [`LLMCaller`](../../src/server/llm-caller.ts) routes by `agentBackend` inside the container; probes CLI via [`resolveAgentCliInDockerContainer`](../../src/server/docker-runner.ts).
- [`ralph-loop.ts`](../../src/server/ralph-loop.ts) runs **one** LLM call at a time; `LLMCaller` keeps a single `currentProcess` (parallel calls would clobber stop/kill).
- Non-Copilot auth vars are documented in [`docker/README.md`](../../docker/README.md); compose `environment` lists Copilot tokens explicitly; other keys rely on `env_file: .env`.
- **Control panel** ([`ControlPanel.tsx`](../../src/client/components/ControlPanel.tsx)): four sections always expanded; single **Save Settings** in Loop Config persists **all** `localSettings` including Docker fields; Save buttons are always enabled (no dirty check); no Reset; no collapse-all.

```mermaid
flowchart TB
  subgraph today [Today]
    RL[RalphLoop] --> LC[LLMCaller]
    LC --> Exec["docker compose exec ralph-agent"]
    Exec --> CLI["one CLI in one container"]
    CLI --> Mount["/workspace = repoRoot bind mount"]
  end
```

```mermaid
flowchart TB
  subgraph panelToday [Control panel today]
    Repo[Repository always open]
    Docker[Docker Agents]
    Loop[Loop Config + Save Settings for ALL settings]
    Epic[Current Epic + Save Epic]
    Prompts[Prompts + Save Prompt]
  end
```

---

## Phase 5 — Control panel UX (collapsible, dirty Save, Reset)

Independent of Docker pool work; can ship early. Touches client only (no server API changes unless Epic save should also persist `epicFile` — see below).

### Collapsible sections

New shared component [`CollapsibleSection.tsx`](../../src/client/components/CollapsibleSection.tsx):

| Prop | Purpose |
|------|---------|
| `id` | Stable key for expand/collapse-all map (`docker`, `loop`, `epic`, `prompts`) |
| `title` | Section heading (replaces bare `<h3>`) |
| `expanded` / `onToggle` | Controlled from parent, or internal state with parent override |
| `children` | Section body |

Wrap in [`ControlPanel.tsx`](../../src/client/components/ControlPanel.tsx):

| Section | Collapsible? |
|---------|----------------|
| [`RepositorySection`](../../src/client/components/RepositorySection.tsx) | **No** (stays fixed at top) |
| [`DockerSection`](../../src/client/components/DockerSection.tsx) | Yes — title **Docker Agents** |
| [`LoopConfigSection`](../../src/client/components/LoopConfigSection.tsx) | Yes — **Loop Configuration** |
| [`EpicSection`](../../src/client/components/EpicSection.tsx) | Yes — **Current Epic** |
| [`PromptsSection`](../../src/client/components/PromptsSection.tsx) | Yes — **Prompts** |

**Header toolbar** (below “Settings” title, above Repository):

```text
[ Collapse all ]  [ Expand all ]
```

- `collapseAll()` → set all four section ids to `expanded: false`
- `expandAll()` → all `true`
- Persist expanded state in `sessionStorage` optional (nice-to-have; default expanded)

**CSS** ([`App.css`](../../src/client/App.css)): chevron on section header, `.collapsible-section--collapsed .collapsible-section__body { display: none }`, respect `prefers-reduced-motion` for toggle animation.

### Dirty detection and Save / Reset

Add [`control-panel-dirty.ts`](../../src/client/control-panel-dirty.ts) (or `src/client/utils/`) with stable comparators:

| Section | Draft state | Saved baseline (from props) | `dirty` when |
|---------|-------------|----------------------------|--------------|
| Docker | `pickDockerSettings(localSettings)` | `pickDockerSettings(settings)` | deep unequal |
| Loop | `pickLoopSettings(localSettings)` | `pickLoopSettings(settings)` | deep unequal |
| Epic | `localEpic`, `localSettings.epicFile` | `epic`, `settings.epicFile` | content or path changed |
| Prompts | `localPrompt` | `prompts[activePrompt]` | unequal |

**`pickDockerSettings`** fields (extend as Epic 004 docker settings land):

`useDocker`, `dockerComposeFile`, `dockerService`, `dockerIsolateBranch`, `dockerPoolSize`, `dockerParallelTasks`, `dockerMountSocket`, `dockerInstalledBackends`, `dockerAutoMergeEpicWork` — exclude read-only branch metadata (`epicBaseBranch`, `dockerWorkBranch`) from dirty/save unless user-editable.

**`pickLoopSettings`**: all other `Settings` keys (models, backend, fleet, frequencies, `requirementsFile`, sort, etc.).

Per section **footer** (last element inside collapsible body, below all inputs):

```text
[ Reset ]  [ Save … ]
```

| Section | Primary button | Disabled when |
|---------|----------------|---------------|
| Docker | **Save Docker** | `!dockerDirty` |
| Loop | **Save loop settings** (rename from “Save Settings”) | `!loopDirty` |
| Epic | **Save epic** | `!epicDirty` |
| Prompts | **Save {label} prompt** | `!promptDirty` |

- **Reset**: restore section draft from saved baseline (re-run `setLocalSettings` merge for docker/loop slices, `setLocalEpic`, `setLocalPrompt` from props). Does **not** hit API.
- After successful Save: baseline updates to new saved state → buttons disable until next edit.
- Secondary actions (**Set Docker**, **Set** epic file, **Refresh Tasks**) stay separate; not gated on dirty (document in tests).

**Epic save behavior:** `handleSaveEpic` should persist **both** epic markdown (`onSaveEpic`) and `epicFile` path (`onSaveSettings` with merged settings) so path edits are not orphaned outside Loop save.

**Docker save behavior:** `handleSaveDocker` in ControlPanel — merge `pickDockerSettings(local)` into settings, call `onSaveSettings`, clear docker dirty.

**Loop save behavior:** existing `handleSaveSettings` narrowed to `pickLoopSettings` + merge with current saved docker fields from server `settings` (not unsaved docker draft unless intentional — prefer merge from **saved** `settings` for docker keys when saving loop only).

### Layout — Save below fields

Audit and fix order in each section:

| Section | Required order (top → bottom) |
|---------|------------------------------|
| Docker | all docker fields → errors/status → **Set Docker** / merge (if any) → footer **Reset \| Save Docker** |
| Loop | all loop fields → **Reset \| Save loop settings** (remove save from middle of fieldset if duplicated) |
| Epic | epic file + Set → hint → textarea → **Reset \| Save epic** → **Refresh Tasks** (secondary, below save) |
| Prompts | prompt selector → textarea → **Reset \| Save prompt** |

[`DockerSection`](../../src/client/components/DockerSection.tsx) today has **Set Docker** mid-section — move validate/merge buttons above footer; add Save/Reset footer at bottom.

### Wiring in ControlPanel

- Pass `dockerDirty`, `onSaveDocker`, `onResetDocker` into `DockerSection`
- Pass `loopDirty`, `onResetLoop` into `LoopConfigSection`; disable save when `!loopDirty`
- Pass `epicDirty`, `onResetEpic` into `EpicSection`
- Pass `promptDirty`, `onResetPrompt` into `PromptsSection`
- Keep `onSettingsDraftChange(localSettings)` for loop-start readiness (unchanged)

```mermaid
flowchart TB
  Header[Collapse all / Expand all]
  Repo[Repository]
  Docker[Docker Agents collapsible]
  Loop[Loop Configuration collapsible]
  Epic[Current Epic collapsible]
  Prompts[Prompts collapsible]

  Header --> Repo --> Docker --> Loop --> Epic --> Prompts
  Docker --> DF[fields]
  DF --> DFooter[Reset / Save Docker]
  Loop --> LF[fields]
  LF --> LFooter[Reset / Save loop]
```

### Tests ([`components.test.tsx`](../../src/client/components/components.test.tsx))

- Collapse all hides section bodies (or aria-expanded false); expand all restores
- Save Docker / Save loop / Save epic / Save prompt disabled when pristine
- Edit field → Save enabled → Save → disabled again
- Edit → Reset → value matches server prop, Save disabled
- Epic: change `epicFile` marks epic dirty; Save persists path
- Docker pool fields (when added): included in docker dirty pick

### Docs

- Short note in [`README.md`](../../README.md) Settings section: collapsible panel, per-section save/reset (no docker/README change required unless nested compose section references panel).

---

## Phase 1 — Universal agent image (build args)

### Dockerfile ([`docker/Dockerfile`](../../docker/Dockerfile))

```dockerfile
ARG INSTALL_COPILOT=true
ARG INSTALL_CLAUDE=false
ARG INSTALL_GEMINI=false
ARG INSTALL_CURSOR=false
```

| Backend | Install when arg true |
|---------|----------------------|
| `copilot` | `npm install -g @github/copilot@<pinned>` |
| `claude` | `npm install -g @anthropic-ai/claude-code` |
| `gemini` | `npm install -g @google/gemini-cli` |
| `cursor-agent` | Per Cursor install docs; validate fails clearly if `INSTALL_CURSOR=true` but binary missing |

### Compose ([`docker-compose.agents.yml`](../../docker-compose.agents.yml))

- Pass build args from env: `INSTALL_CLAUDE=${INSTALL_CLAUDE:-false}`, etc.
- Forward all auth vars in `environment`: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `CURSOR_API_KEY`, plus existing Copilot/GitHub tokens.

### Validation ([`docker-runner.ts`](../../src/server/docker-runner.ts), `POST /api/docker/validate`)

- Probe **each** backend listed in `settings.dockerInstalledBackends` (or inferred from build).
- Always probe **active** `settings.agentBackend`; warn if selected backend was not built into the image.

### Docs (Phase 1 subset)

See [Documentation updates](#documentation-updates) — at minimum build-arg matrix and multi-CLI rebuild commands in both README files.

---

## Phase 1b — Nested compose (agents spawn target-project containers)

**Problem:** Dev/QA agents in `ralph-agent` cannot run `docker compose` for the **target repo** under `/workspace` unless they can talk to a Docker daemon with permission to create containers.

**Approach (v1): Docker socket forwarding** — not DinD sidecars unless socket mounting is insufficient on a platform.

### Dockerfile ([`docker/Dockerfile`](../../docker/Dockerfile))

When `INSTALL_DOCKER_CLI=true` (build arg, default `false`):

- Install **Docker CLI** and **Compose v2 plugin** in the agent image (e.g. `apt-get install docker-ce-cli docker-compose-plugin` on bookworm, or official static bundles).
- Ensure `docker` and `docker compose` work when `DOCKER_HOST` points at the mounted socket.

Keep image slim when nested compose is not needed (`INSTALL_DOCKER_CLI=false`).

### Compose ([`docker-compose.agents.yml`](../../docker-compose.agents.yml))

Opt-in volume (controlled by env at `compose up` time):

```yaml
volumes:
  - ${RALPH_REPO_ROOT:-.}:/workspace
  # When RALPH_DOCKER_SOCKET=1:
  - ${DOCKER_SOCKET:-/var/run/docker.sock}:/var/run/docker.sock
environment:
  - DOCKER_HOST=unix:///var/run/docker.sock   # when socket mounted
```

Use compose **profiles** or override file `docker-compose.agents.nested.yml` so default remains socket-free.

### Settings ([`settings-manager.ts`](../../src/server/settings-manager.ts), [`DockerSection.tsx`](../../src/client/components/DockerSection.tsx))

```ts
dockerMountSocket: boolean;  // default false — enable for target repos that run compose/E2E inside the agent
```

UI:

- Checkbox **Allow agents to run Docker in the target repo** (mount host Docker socket).
- Warning: grants host-level Docker control; only use on trusted machines.
- When enabled, **Set Docker** runs **inside** the agent container: `docker info` and `docker compose version` must succeed.

### Validation ([`docker-runner.ts`](../../src/server/docker-runner.ts))

Extend `ensureDockerAgentRunning` / validate when `dockerMountSocket`:

1. Host: confirm socket path exists (`/var/run/docker.sock` or `DOCKER_SOCKET` env).
2. Container: `docker compose exec … docker info` exit 0.
3. Container: `docker compose -f /workspace/<known-test-path> config` optional smoke if target repo provides `docker/docker-compose.yml` (best-effort, do not fail validate if file missing).

### Dev prompt / blocked-task guidance

- Inject into dev/QA context when `dockerMountSocket` is on: “You may run `docker compose` against files under `/workspace`; daemon is the host via mounted socket.”
- When validate fails with permission errors, set `blocked.needs` to mention enabling **Allow agents to run Docker** or running Ralph with `useDocker: false` on the host.

### Target-project E2E pattern (reference)

Document the harness pattern this unlocks (from real blocked task):

| Step | Command / check |
|------|-----------------|
| Preflight | `docker compose -f docker/docker-compose.yml config` |
| Stack up | `docker compose -f docker/docker-compose.yml up -d --build` |
| Health | postgres, airflow-*, eventhub-emulator, ui healthy |
| Tests | `RUN_E2E_TESTS=1 pytest tests/e2e -v -m e2e` |
| Accept | job `done`, `crud_counts.add == 10`, events `published`, SSE ≥ 10 events |

Ralph does not implement this test — the **agent** runs it inside the container once nested Docker works.

### Alternatives (document only, not v1)

| Approach | When |
|----------|------|
| `useDocker: false` | Run agent on host; host Docker already works |
| Privileged DinD | Only if socket mounting blocked; higher risk |
| Remote Docker context | Advanced CI; `DOCKER_HOST=tcp://…` |

### Tests (Phase 1b)

- Unit: compose file generation includes socket volume when `dockerMountSocket` setting mapped to `RALPH_DOCKER_SOCKET=1`.
- Mocked exec: validate runs `docker info` inside container when flag set.
- Smoke (`DOCKER_SMOKE=1` + socket): agent container runs `docker run --rm hello-world` or `docker compose ls` (host must allow).

---

## Phase 2 — Container pool + worktree isolation

### Settings ([`settings-manager.ts`](../../src/server/settings-manager.ts), [`types.ts`](../../src/client/types.ts), [`DockerSection.tsx`](../../src/client/components/DockerSection.tsx))

```ts
dockerPoolSize: number;                    // default 1, min 1, max 8
dockerParallelTasks: boolean;              // default false
dockerInstalledBackends?: AgentBackendId[]; // optional, for validate UI
// Stretch:
dockerPlanParallel?: boolean;              // default false
```

UI: **Pool size** number input, **Run backlog tasks in parallel** checkbox (disabled when `dockerPoolSize === 1`).

### Compose scaling

```bash
docker compose -f ... up -d --scale ralph-agent=${dockerPoolSize}
```

Update [`buildDockerSpawn`](../../src/server/docker-runner.ts):

```ts
buildDockerSpawn(composeFile, service, command, commandArgs, { containerIndex?: number })
// appends: exec ... --index N when set
```

### New module: [`docker-pool.ts`](../../src/server/docker-pool.ts)

| Function | Behavior |
|----------|----------|
| `ensureDockerPool(...)` | Scale service, wait for N running containers, probe toolchain + CLIs per index |
| `listPoolContainers(...)` | Ordered container IDs from `docker compose ps -q` |
| `acquireSlot()` / `releaseSlot()` | In-memory allocator: slot 0..N-1 → container index |

### Git worktrees ([`git-manager.ts`](../../src/server/git-manager.ts))

See **[Phase 2c — Git merge-back](#phase-2c--git-merge-back-parallel--loop-end)** for branch naming, merge targets, and loop-end auto-merge. Summary:

1. Per parallel task: `createWorktree(slot, worktreeBase)` where `worktreeBase = dockerWorkBranch || epicBaseBranch`.
2. `buildDockerSpawn` uses `-w /workspace/.ralph/worktrees/slot-n` (single repo mount).
3. Task done: `mergeWorktreeBranch` into `worktreeBase` (checkout target first).
4. Loop end (when isolation on): merge `dockerWorkBranch` → `epicBaseBranch` if `dockerAutoMergeEpicWork` (default true).
5. Cleanup: default keep worktrees; document `git worktree remove`.

### `LLMCaller` concurrency ([`llm-caller.ts`](../../src/server/llm-caller.ts))

- Replace `currentProcess` with `Map<slotId, ChildProcess>`; `stop()` kills all.
- Extend `LLMCallOpts`: `dockerContainerIndex?`, `dockerWorktreeCwd?`.

### `ensureDockerAgentRunning`

Wrap or extend: when `dockerPoolSize > 1`, call pool ensure and validate exec on indices `0..N-1`.

---

## Phase 2c — Git merge-back (parallel + loop end)

Extends [Epic 003 § Merge work back to the epic base branch](epic-003-docker-container.plan.md#merge-work-back-to-the-epic-base-branch) for the container pool and worktree path. Epic 003 ships manual **Merge work into epic branch**; Epic 004 adds correct parallel slot merges and **automatic** final merge when the loop completes successfully.

### Branch stack

| Layer | Name | When |
|-------|------|------|
| Starting branch | `epicBaseBranch` | Captured at loop start (`getCurrentBranch()`) |
| Work branch | `dockerWorkBranch` e.g. `ralph/epic-<slug>-<date>` | When `dockerIsolateBranch` (main worktree checked out here) |
| Slot branch | `<worktreeBase>-slot-<n>` | Per worktree under `.ralph/worktrees/slot-<n>` |

`worktreeBase = settings.dockerWorkBranch || settings.epicBaseBranch`.

```mermaid
flowchart LR
  epicBase["epicBaseBranch"]
  workBranch["dockerWorkBranch"]
  slotBranch["worktreeBase-slot-N"]

  epicBase -->|"dockerIsolateBranch at start"| workBranch
  workBranch -->|"parallel worktree add"| slotBranch
  slotBranch -->|"after each task"| workBranch
  workBranch -->|"loop end dockerAutoMergeEpicWork"| epicBase
  epicBase -->|"isolate off sequential"| epicBase
```

### 2c.1 — Fix parallel worktree fork base (implementation gap)

**Shipped gap:** [`ralph-loop.ts`](../../src/server/ralph-loop.ts) calls `createWorktree(slot, epicBase)` and slot branches `${epicBaseBranch}-slot-<n>` even when the main worktree is on `dockerWorkBranch`.

**Target behavior:**

- Pass `worktreeBase` (not raw `epicBaseBranch` only) into `createWorktree` for parallel dev/QA and plan-parallel research slots.
- Rename slot branches to `${worktreeBase}-slot-<n>` in [`git-manager.ts`](../../src/server/git-manager.ts) `createWorktree` / `mergeWorktreeBranch`.

### 2c.2 — Fix `mergeWorktreeBranch` (implementation gap)

**Shipped gap:** [`mergeWorktreeBranch`](../../src/server/git-manager.ts) merges the slot branch into whatever HEAD is at `repoRoot` and ignores the `targetBranch` argument.

**Target behavior:**

1. `checkout` `targetBranch` on the main worktree (`createOrCheckoutBranch` or `git checkout`).
2. `git merge --no-ff` slot branch (`mergeWorkBranch`).
3. On conflict: return `{ ok: false, conflicts: string[] }`; log warning in parallel path (do not throw away merge state).

[`ralph-loop.ts`](../../src/server/ralph-loop.ts) parallel path should pass `targetBranch = worktreeBase` consistently.

### 2c.3 — Worktree-aware `autoCommit`

**Shipped gap:** [`autoCommitTask`](../../src/server/ralph-loop.ts) always runs git from `repoRoot`; parallel agents execute in `.ralph/worktrees/slot-N`.

**Target behavior:**

- Extend `GitManager.autoCommit(taskNum, title, cwd?: string)` — `spawn` git with `cwd` = worktree host path when provided.
- After verified task in `runDevQALoop`, when `slotOpts.worktreeCwd` is set, map `/workspace/.ralph/worktrees/slot-N` → `path.join(repoRoot, '.ralph/worktrees/slot-N')` for auto-commit.
- Sequential Docker (no slot): unchanged — commits on main worktree (`dockerWorkBranch` or `epicBaseBranch`).

### 2c.4 — Auto-merge on successful loop end

**Setting** ([`settings-manager.ts`](../../src/server/settings-manager.ts), [`types.ts`](../../src/client/types.ts), [`DockerSection.tsx`](../../src/client/components/DockerSection.tsx)):

```ts
dockerAutoMergeEpicWork: boolean;  // default true
```

**UI:** Checkbox — **Automatically merge work into epic branch when loop finishes** (visible when `dockerIsolateBranch` and branch metadata exist). Include in `pickDockerSettings` ([`control-panel-dirty.ts`](../../src/client/control-panel-dirty.ts)).

**Server:**

- Extract shared helper from [`POST /api/git/merge-epic-work`](../../src/server/index.ts) (e.g. `mergeEpicWorkIntoBase(gitManager, settings)`).
- Call from `RalphLoop.finishRun()` when:
  - Loop ended without user stop (`!wasStopped`)
  - No error path in `finishRun`
  - `settings.useDocker && settings.dockerIsolateBranch && settings.dockerAutoMergeEpicWork`
  - `epicBaseBranch` and `dockerWorkBranch` set and differ
- Same merge semantics as manual API: checkout `epicBaseBranch`, `merge --no-ff dockerWorkBranch`, return conflicts without auto-resolve.
- On success: `[system] Merged work branch into epic base: <dockerWorkBranch> → <epicBaseBranch>`.
- On conflict: log conflict paths; branch status API + UI remain source of truth for retry.

**Manual merge:** Keep **Merge work into epic branch** for conflicts, mid-epic use, and when auto-merge is disabled.

**Isolation off:** Skip auto-merge (no `dockerWorkBranch`; commits target `epicBaseBranch` directly).

```mermaid
sequenceDiagram
  participant RL as RalphLoop
  participant Git as GitManager
  participant Slot as Slot_worktree

  RL->>Git: capture epicBaseBranch
  alt dockerIsolateBranch
    RL->>Git: checkout dockerWorkBranch
  end
  par parallel task
    RL->>Git: createWorktree slot worktreeBase
    RL->>Slot: dev/QA in slot cwd
    RL->>Git: autoCommit in slot cwd
    RL->>Git: mergeWorktreeBranch to worktreeBase
  end
  RL->>RL: finishRun success
  alt dockerAutoMergeEpicWork
    RL->>Git: merge dockerWorkBranch into epicBaseBranch
  end
```

---

## Phase 3 — Parallel dev/QA ([`ralph-loop.ts`](../../src/server/ralph-loop.ts))

When `useDocker && dockerParallelTasks && dockerPoolSize > 1`:

```mermaid
sequenceDiagram
  participant RL as RalphLoop
  participant Pool as DockerPool
  participant T1 as Slot0_container
  participant T2 as Slot1_container

  RL->>RL: plan phase sequential
  RL->>RL: pick up to N backlog tasks
  par parallel dev/QA
    RL->>Pool: acquire slot 0
    RL->>T1: dev/QA worktree 0
    RL->>Pool: acquire slot 1
    RL->>T2: dev/QA worktree 1
  end
  RL->>RL: per-task mergeWorktreeBranch + task-status lock
  Note over RL: on loop finish success
  RL->>RL: auto-merge dockerWorkBranch to epicBaseBranch if dockerAutoMergeEpicWork
```

- **Mutex** on [`TaskManager`](../../src/server/task-manager.ts) writes.
- Cap in-flight tasks at `dockerPoolSize`.
- After each parallel task: merge slot branch → `worktreeBase` per Phase 2c.
- Plan phase unchanged in v1 (plan-parallel slots use same `worktreeBase` when stretch is enabled).

---

## Phase 4 (stretch) — Planning agent dispatches pool jobs

1. Extend plan prompt for structured parallel research sub-prompts.
2. Parse plan output; `Promise.all` dispatch sub-jobs to pool (slot + scratch/read-only worktree).
3. Aggregate into backlog / `task-status.json`.
4. Gated by `dockerPlanParallel` and `dockerPoolSize > 1`.

---

## Documentation updates

Documentation is a **deliverable** for this epic, not an afterthought. Update both README files whenever behavior or settings change.

### [`README.md`](../../README.md) — project root

Extend **Docker Agent Execution** (and **Settings Defaults** / **CLI flags** as needed):

| Topic | What to document |
|-------|------------------|
| Multi-CLI image | `INSTALL_*` build args; example `docker compose build` with env; link to `docker/README.md` for detail |
| Pool | `dockerPoolSize`, `dockerParallelTasks` in settings table; default `1`; max and resource warning |
| Parallel tasks | Dev/QA only; requires `useDocker` + pool > 1; worktrees under `.ralph/worktrees/` |
| Merge-back | Three layers: slot → work branch (per task) → `epicBaseBranch` (loop end, default on via `dockerAutoMergeEpicWork`); manual merge button for conflicts |
| Validate | **Set Docker** checks active backend CLI + (when pool > 1) all container indices reachable |
| Compose scale | `up -d --scale ralph-agent=N` equivalent; recreate after `.env` / build-arg changes |
| Fleet vs pool | Short note: `/fleet` is per-container Copilot subagents; pool is multiple backlog tasks |
| CLI flags | `--docker-pool-size`, `--docker-parallel-tasks` (if added in [`cli-args.ts`](../../src/server/cli-args.ts)) |
| Troubleshooting | Wrong CLI in image, `--index` unsupported (upgrade Compose), slot/work/epic merge conflicts, auto-merge skipped (setting off or isolation off), parallel auto-commit empty (worktree cwd) |
| Nested compose | `dockerMountSocket`, security warning, `INSTALL_DOCKER_CLI`, blocked-task “cannot create containers” |
| Control panel | Collapsible Docker / Loop / Epic / Prompts; Collapse all / Expand all; per-section Save (dirty-only) and Reset |

Add a one-line pointer under Epic/docs if useful: “Parallel Docker pool — see [Epic 004](docs/epics/epic-004-parallel-docker-support.plan.md).”

### [`docker/README.md`](../../docker/README.md) — operator guide

Add or expand sections:

1. **Build the image for your backends** — table of `INSTALL_COPILOT` / `INSTALL_CLAUDE` / `INSTALL_GEMINI` / `INSTALL_CURSOR`, sample `.env` + compose build, pinned versions.
2. **Run a container pool** — `dockerPoolSize`, scale command, verify `docker compose ps` shows N instances.
3. **Parallel dev/QA and worktrees** — directory layout; slot branch `${worktreeBase}-slot-N`; per-task merge into work branch; loop-end auto-merge into `epicBaseBranch` (`dockerAutoMergeEpicWork`, default on).
4. **Validate from Ralph** — what **Set Docker** probes (per-backend CLI, per-index exec, node/git/pnpm).
5. **Troubleshooting** — new rows: pool not scaling, exec lands on wrong index, worktree already exists, parallel task file conflicts, slot merge conflict, auto-merge failed (dirty tree / conflicts), auto-commit not on slot branch.
6. **Nested Docker (target repo compose)** — enable socket mount, `INSTALL_DOCKER_CLI`, verify `docker info` inside agent, E2E harness checklist, when to use host `useDocker: false` instead.

Keep [Step 2 — authentication](docker/README.md#step-2--add-authentication-env) aligned: every backend env var listed in compose `environment`, not only Copilot.

### Optional

- [`docs/requirements.md`](../../docs/requirements.md) — checklist items for Epic 004 when shipped.
- Cross-link from [Epic 003](epic-003-docker-container.plan.md) footer: “Follow-on: Epic 004 (parallel pool, multi-CLI image).”

---

## Files to touch

| Area | Files |
|------|--------|
| Image / compose | [`docker/Dockerfile`](../../docker/Dockerfile), [`docker-compose.agents.yml`](../../docker-compose.agents.yml), [`docker/README.md`](../../docker/README.md) |
| Pool + spawn | [`docker-runner.ts`](../../src/server/docker-runner.ts), new `docker-pool.ts`, tests |
| Git / merge-back | [`git-manager.ts`](../../src/server/git-manager.ts), [`ralph-loop.ts`](../../src/server/ralph-loop.ts), [`index.ts`](../../src/server/index.ts), [`control-panel-dirty.ts`](../../src/client/control-panel-dirty.ts) |
| Loop / LLM | [`ralph-loop.ts`](../../src/server/ralph-loop.ts), [`llm-caller.ts`](../../src/server/llm-caller.ts) |
| API / UI | [`index.ts`](../../src/server/index.ts), [`DockerSection.tsx`](../../src/client/components/DockerSection.tsx) |
| Control panel UX | [`ControlPanel.tsx`](../../src/client/components/ControlPanel.tsx), [`CollapsibleSection.tsx`](../../src/client/components/CollapsibleSection.tsx), [`control-panel-dirty.ts`](../../src/client/control-panel-dirty.ts), [`LoopConfigSection.tsx`](../../src/client/components/LoopConfigSection.tsx), [`EpicSection.tsx`](../../src/client/components/EpicSection.tsx), [`PromptsSection.tsx`](../../src/client/components/PromptsSection.tsx), [`App.css`](../../src/client/App.css) |
| Docs | [`README.md`](../../README.md), [`docker/README.md`](../../docker/README.md) |
| Tests | See [Testing](#testing) |

---

## Risks and constraints

- **Resources:** `dockerPoolSize` concurrent agents multiply CPU/RAM/API usage — enforce max in settings validation.
- **Cursor CLI in Docker:** may not be a single `npm install`; document manual steps if build arg cannot automate.
- **Compose `--index`:** require recent Compose plugin; validate API should suggest upgrade on failure.
- **Git conflicts:** parallel slot merges and loop-end auto-merge use the same conflict reporting as `merge-epic-work`; never auto-resolve.
- **Auto-merge with dirty main worktree:** document commit/stash before loop end or disable `dockerAutoMergeEpicWork` and merge manually.
- **Checkout after auto-merge:** loop end leaves repo on `epicBaseBranch`; log clearly for the operator.
- **Socket mount security:** agents can start arbitrary host containers; default off; call out in UI and README.
- **Nested compose on locked-down hosts:** Cursor/cloud sandboxes without socket or cgroup rights will still block — same outcome as task #13 `blocked.needs`; not fixable in software alone.

---

## Implementation order

**Track A — Control panel (can start immediately)**

1. **Phase 5** — `CollapsibleSection`, collapse/expand all, dirty helpers, per-section Save/Reset footers, split Docker vs Loop save, epic path on Save epic, CSS, component tests

**Track B — Docker stack**

2. Phase 1 — build-arg Dockerfile + compose env + multi-CLI validate + **README build-arg docs**
3. **Phase 1b** — `INSTALL_DOCKER_CLI`, optional socket mount, `dockerMountSocket` setting, in-container `docker info` validate, nested-compose docs (unblocks target-repo E2E/compose tasks)
4. Phase 2 — settings, `docker-pool.ts`, scale + `--index`, worktrees, multi-process `LLMCaller` + **unit tests for pool/spawn** (wire new docker fields into `pickDockerSettings` / DockerSection footer)
5. Phase 3 — parallel `runDevQALoop` with task-manager lock + **ralph-loop / integration tests**
6. **Phase 2c** — worktree base + `mergeWorktreeBranch` checkout fix, worktree `autoCommit`, `dockerAutoMergeEpicWork` + `finishRun` merge (after Phase 3 parallel path exists, or in same PR if parallel already shipped)
7. **Documentation pass** — finalize [`README.md`](../../README.md) and [`docker/README.md`](../../docker/README.md) (pool, parallel, merge-back, nested compose, panel UX, troubleshooting)
8. **Docker smoke** (optional script, local/CI when `DOCKER_SMOKE=1`) — scaled pool + nested `docker info` inside agent when socket enabled
9. Phase 4 — plan-phase pool dispatch (stretch PR)

---

## Testing

Tests must prove the **new Docker pattern works** without requiring every `npm test` run to have Docker installed. Use mocks for default CI; gate real-Docker checks behind an env flag.

### Unit tests (required — run in `npm test` / `test:ci`)

| File | Coverage |
|------|----------|
| [`docker-runner.test.ts`](../../src/server/docker-runner.test.ts) | `buildDockerSpawn` with `containerIndex` → argv includes `--index N`; multi-backend CLI probe errors; nested validate runs in-container `docker info` when `dockerMountSocket` |
| **new** [`docker-pool.test.ts`](../../src/server/docker-pool.test.ts) | `ensureDockerPool` passes `--scale`; `listPoolContainers` ordering; `acquireSlot` / `releaseSlot` exhaustion and release |
| [`llm-caller.test.ts`](../../src/server/llm-caller.test.ts) | Two parallel `call()` with different `dockerContainerIndex`; `stop()` kills all tracked processes; worktree cwd in spawn argv |
| [`git-manager.test.ts`](../../src/server/git-manager.test.ts) | Create/remove worktree per slot; worktree from `dockerWorkBranch` ref; `mergeWorktreeBranch` checks out target before merge |
| [`ralph-loop.test.ts`](../../src/server/ralph-loop.test.ts) | When `dockerParallelTasks` + pool 2, dispatches at most two dev paths (mock `LLMCaller`); `finishRun` calls merge when `dockerAutoMergeEpicWork`; skipped when stopped or setting false |
| [`components.test.tsx`](../../src/client/components/components.test.tsx) | Pool size input; parallel checkbox disabled when `dockerPoolSize === 1`; `dockerAutoMergeEpicWork` in docker dirty pick; **Phase 5** collapse all, dirty Save, Reset |
| [`cli-args.test.ts`](../../src/server/cli-args.test.ts) or existing pattern | New flags map to settings if added |

**Definition of done (automated):** `npm run test:ci` passes with zero Docker daemon dependency.

### Integration-style tests (mocked Docker, required)

- Validate API path: mock `ensureDockerPool` / `resolveAgentCliInDockerContainer` — `POST /api/docker/validate` returns ok when pool size 2 and all indices probed (extend server tests or `docker-runner` integration).
- Regression: single-container path (`dockerPoolSize: 1`) unchanged — existing `llm-caller` docker tests still pass.

### Optional: real Docker smoke (local / CI job)

Add [`scripts/docker-pool-smoke.mjs`](../../scripts/docker-pool-smoke.mjs) (or document manual steps in `docker/README.md`):

1. Skip unless `DOCKER_SMOKE=1` and `docker info` succeeds.
2. Build image with `INSTALL_COPILOT=true` (minimal).
3. `docker compose -f docker-compose.agents.yml up -d --scale ralph-agent=2 --build`.
4. Assert two running containers; `docker compose exec --index 0` and `--index 1` both run `node -v` and `command -v copilot`.
5. Tear down: `docker compose down`.

Document in README: “CI does not run Docker smoke by default; maintainers run `DOCKER_SMOKE=1 node scripts/docker-pool-smoke.mjs` before release.”

### Manual QA checklist (before closing epic)

- [ ] Build with `INSTALL_CLAUDE=true`, switch Settings to `claude`, **Set Docker** succeeds
- [ ] `dockerPoolSize=2`, parallel tasks on, two backlog items run without interleaved file corruption
- [ ] Stop loop mid-parallel — both container exec processes terminate
- [ ] README and docker/README steps reproduce setup on a clean machine
- [ ] `dockerMountSocket` enabled: inside `ralph-agent`, `docker info` succeeds and target-repo `docker compose config` parses
- [ ] Representative target task (compose up + pytest e2e) completes or fails with actionable errors, not “cannot create containers” inside agent
- [ ] Control panel: Collapse all / Expand all; each section Save disabled until edit; Reset reverts; Save buttons below section fields
- [ ] Parallel epic with isolation: slot commits merge to work branch; loop end auto-merge lands on `epicBaseBranch`; disable `dockerAutoMergeEpicWork` and use manual merge when testing conflicts

```mermaid
flowchart LR
  subgraph ci [npm run test:ci]
    Unit[docker-runner + docker-pool + llm-caller mocks]
    Loop[ralph-loop + git-manager mocks]
    UI[DockerSection tests]
  end
  subgraph smoke [DOCKER_SMOKE=1 optional]
    Real[compose scale=2 + exec --index 0/1]
  end
  ci --> ship[Epic 004 done]
  smoke --> ship
```
