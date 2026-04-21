# Todo experiment — product requirements

Authoritative requirements for the client-side todo application in this directory. Planning and implementation must stay within these bounds unless `ralph/epic.md` is updated and this document is revised or explicitly extended.

## 1. Product overview

A single-page **React** todo app built with **Vite** and **TypeScript**. Users add tasks, see them in a list, mark them complete or incomplete, and archive items they want out of the main flow—all with **local browser persistence** so a refresh does not lose data. The experience should feel **fast, calm, and polished**: clear hierarchy, spacing, typography, and deliberate interaction design (not default-browser-widget rough).

## 2. Technical constraints

| Area | Requirement |
|------|---------------|
| Build | Vite for dev server and production build. `npm run dev` and `npm run build` must succeed. |
| UI | **React 18** with **TypeScript** throughout `src/`. |
| Hosting model | Static/client-only: no backend, auth, or multi-user sync. |
| Persistence | Store todos in **localStorage** (JSON). Load on startup; save when data changes. |

## 3. Functional requirements

### 3.1 Create todos

- User can enter a new todo (text field + submit or equivalent).
- Empty or whitespace-only submissions must not create todos.
- New todo appears in the list without a full page reload.

### 3.2 List todos

- Non-archived todos appear in the primary list unless a filter narrows the view.
- Each item shows at least: readable title/text and a clear **complete** state (checkbox or toggle).
- **Default ordering:** incomplete before completed, then by creation time (or stable order). Document the rule in a short comment for verification.

### 3.3 Complete and uncomplete

- User can mark a todo completed and uncomplete it again.
- Completed state is visible at a glance (styling and/or control state).

### 3.4 Archive and recovery

- User can **archive** a todo so it is **not** shown in the default main list.
- Archived todos remain stored and are **recoverable** (unarchive or an Archived view).
- Unless viewing an **archived** scope, archived items must not appear in the primary active list.

### 3.5 Filters or views

- Provide segments or filters: **All**, **Active** (incomplete, non-archived), **Completed**, and **Archived** (or equivalent labels). Behavior must match the labels.

## 4. Data model (minimum)

Each todo carries at least:

- Stable **unique id** (for keys, storage, updates).
- **Title** (string).
- **Completed** (boolean).
- **Archived** (boolean).
- **Created timestamp** (for default sort).

Serialization must round-trip through localStorage without losing fields.

## 5. UI and accessibility

- **Layout:** One main screen; no multi-page routing required.
- **Responsive:** Usable on narrow and wide widths without horizontal scroll for normal content.
- **Keyboard:** Primary actions usable with keyboard where reasonable; visible focus states.
- **Visual quality:** Cohesive palette, type scale, spacing, hover/focus/disabled states.

## 6. Acceptance criteria (release checklist)

- [ ] `npm run dev` and `npm run build` complete without errors.
- [ ] Create todo → appears in list; empty input rejected.
- [ ] Complete / uncomplete persists after browser refresh.
- [ ] Archive removes from main list; user can access or restore archived items.
- [ ] After refresh, all todos and states match pre-refresh data.
- [ ] Production build runs correctly (e.g. `npm run preview`).
- [ ] UI reads as intentional and consistent.

## 7. Out of scope (v1)

- Backend APIs, accounts, collaboration, sync across devices.
- Native mobile apps beyond responsive web.
- Calendar/due dates as a core feature.
- Recurring tasks.
- **Tags**, **hierarchical tasks**, and **custom section headings** — follow-on epics; not required for v1.

## 8. Traceability

These requirements implement the outcomes and boundaries in `ralph/epic.md`. When the epic changes, update this document or add an explicit delta.

## Last updated

2026-04-03
