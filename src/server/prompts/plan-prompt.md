# Plan

Review the current project state, update the task list, and select the next task to implement.

## Context

Read before planning:
- `ralph/memory.md` — accumulated project learnings and conventions; apply them
- `ralph/task-status.json` — current task inventory and completion state
- `requirements.md` — authoritative product requirements and acceptance criteria
- `ralph/epic.md` — current epic scope and priorities
- `README.md` — project overview

Survey the codebase to understand what is currently implemented.

## Instructions

### Update the task list

Produce a JSON array of all tasks still needed to complete the epic. Rules:
- Include ALL remaining work: features, integrations, tests, documentation.
- Exclude `"done"` and `"blocked"` tasks.
- Preserve existing `id` values for unchanged tasks.
- Assign new IDs starting from (max existing ID + 1).
- Order by optimal implementation sequence (dependencies first).
- Every entry: `{ "id": integer, "title": "3-8 words", "description": "1-2 sentences", "status": "backlog" }`.
- Do NOT write any files; the loop engine owns `task-status.json`.

### Select and describe the next task

Select the first `"backlog"` task. Write a full, implementation-ready description including:
- What needs to be done and why
- Clear implementation guidance
- Testing steps and acceptance criteria

Constraints: no implementation code in the description; traceable to `requirements.md` and `ralph/epic.md`; do NOT modify completed or blocked tasks (new related work gets a new ID).

## Output Format

Respond with exactly this structure:

1. JSON block (first in response):

```json
[
  { "id": 6, "title": "Short task title", "description": "1-2 sentence description.", "status": "backlog" }
]
```

2. Full implementation-ready task description.

3. Remaining tasks section:

```markdown
## Remaining Planned Tasks
- Task title
- Task title
```

4. Task ID signal (last in response):

```
<task-id>N</task-id>
```

If all tasks are complete, output only:

```
<status>complete</status>
```

Use markdown only. Use only US English keyboard characters.

## Memory

After planning, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: codebase conventions, build/test commands, patterns, constraints. Do not duplicate entries already present.