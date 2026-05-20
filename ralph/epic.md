# Epic 003 — Docker agents, fleet mode, model catalog UI

## Business outcome

Ralph can run dev/QA with optional Copilot fleet mode, optional Docker-isolated agents, clearer epic file setup, and **per-platform model dropdowns** backed by a shared catalog and an HTML models reference page.

## Scope

- Fleet mode (capability-gated; dev/QA only; Copilot `/fleet` today)
- Docker agent transport + host install/running checks + git work-branch merge-back
- Epic File **Set** button (load or create epic path)
- **Agent model catalog** (`src/shared/agent-models.ts`) + dropdown UI + `/models-reference` page
- Reference doc: [`docs/coding-agents-available-models.md`](../docs/coding-agents-available-models.md)

## Non-goals

- Filling every catalog metadata column (strength, tier, multiplier, YOLO, fleet) inside TypeScript for v1 — those details live in the markdown reference and the HTML popup (Task 14).
- Re-implementing tasks 1–11 (fleet, Docker, Epic Set) — already done unless QA finds a regression.

## Success criteria

- All backlog tasks for this epic marked **done** with passing `npm run test:ci` and `npm run typecheck`.
- Model dropdowns show the correct catalog per `agentBackend` with preferred plan/dev/qa defaults.

---

## Current focus: Task 12 — stop dev/QA thrashing

**Problem:** Task 12 (“Create agent-models catalog module”) has run many dev iterations because agents keep re-writing an **already complete** file or never emit `<status>done</status>` / `<status>verified</status>`.

**Canonical spec:** see **“Task 12 thrashing”** and **“Revised Task 12”** in [`docs/epics/epic-003-docker-container.plan.md`](../docs/epics/epic-003-docker-container.plan.md).

### Task 12 definition of done (concrete)

1. **Inspect** `src/shared/agent-models.ts` — if exports and model IDs already match the plan, **do not recreate the file**.
2. **Ensure** `src/shared/agent-models.test.ts` exists and covers:
   - For each backend, `PREFERRED_MODELS_BY_BACKEND[backend].plan|dev|qa` is in `AGENT_MODEL_CATALOG[backend]`.
   - `isModelInCatalog('copilot', 'gpt-5.4')` → true; `isModelInCatalog('copilot', 'nonexistent')` → false.
3. Run `npm run typecheck` and `npm run test:ci -- src/shared/agent-models.test.ts`.
4. Empty `strength` / `tier` / `multiplier` / `yoloMode` / `fleetMode` strings in catalog entries are **acceptable for v1**.
5. Dev output must end with `<status>done</status>`. QA output must end with `<status>verified</status>` when the checklist passes.

### Task order after 12

| ID | Title | Depends on |
|----|-------|------------|
| 12 | Agent-models catalog (minimal v1 + tests) | `docs/coding-agents-available-models.md` |
| 13 | Model dropdowns + View models link | 12 |
| 14 | `/models-reference` + `/api/agent-models` | 12 (may render from markdown or catalog IDs) |
| 15 | Remaining tests | 12–14 |

## Planner hints

- When planning, **split** “full metadata in TS” from Task 12 — that was causing QA to reject complete ID-only catalogs.
- If Task 12 checklist is satisfied on disk, plan Task 12 as **verify-only** or mark done and advance to 13.
- Update `ralph/memory.md` to remove any line claiming `src/shared/` does not exist if `agent-models.ts` is present.
