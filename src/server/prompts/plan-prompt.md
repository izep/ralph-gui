# Plan

Review the current project state, update the task list, and select the next task to implement.

## Context

Read before planning:
- `ralph/memory.md` — accumulated project learnings and conventions; apply them
- `ralph/task-status.json` — current task inventory and completion state

Survey the codebase to understand what is currently implemented.

## Instructions

### Update the task list

Produce a JSON array of all tasks still needed to complete the epic. Rules:
- Include ALL remaining work: features, integrations, tests, documentation.
- Exclude `"done"` and `"blocked"` tasks.
- Preserve existing `id` values for tasks that represent the same intent.
- Only change tasks when the tasks when the state of the project warrents it, no unnessacary changes.
- Do change, delete, add and reorder tasks as needed to represent the optimal implimentation path for the epic from the current state.
- Assign new IDs starting from (max existing ID + 1).
- Order by optimal implementation sequence (dependencies first).
- Every entry: 
```json
{ "id": integer, "title": "3-8 words", "description": "a full, implementation-ready description including:
- What needs to be done and why
- Clear implementation guidance
- Testing steps and acceptance criteria", "status": "backlog" }
```
- Do NOT write any files; the loop engine owns `task-status.json`.


## Output Format

Respond with exactly this structure:

JSON block:

```json
[
  { "id": 6, "title": "Short task title", "description": "full task description.", "status": "backlog" },
  { "id": 7, "title": "Another Short title", "description": "next full task description.", "status": "backlog" }
]
```

If all tasks are complete, output only:

```
<status>complete</status>
```

Use markdown only. Use only US English keyboard characters.

## Memory

After planning, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: codebase conventions, build/test commands, patterns, constraints. Do not duplicate entries already present.