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

- Task column display order: `taskColumnSort` is persisted on `Settings` (default `idAsc`). Wiring `sortTasks` into `App.tsx` controls visible row order only; merge-on-read fills the key for older `settings.json` files.

- If `npm run typecheck` fails with TS2688 (cannot find type definition file for `node`), install `@types/node` as a devDependency; the root `package.json` may not list it even when `tsconfig` references Node types.

- `docs/epics/epic-sort.md` describes the full Task Column Sort epic (UI select + `sortTasks` helper); until those pieces land, the board still renders tasks in `groupTasks` order even though the setting exists.