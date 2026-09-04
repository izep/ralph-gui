# Plan

Review the current project state and produce a complete remaining-task list for the epic. The loop always implements the first backlog task after it writes your JSON to `ralph/task-status.json` (that JSON is the Kanban backlog).

## Context

Requirements (Project Overview) and the current epic are authoritative. If they conflict with the code, plan toward the documents.

Read `ralph/memory.md` before starting — accumulated project learnings and conventions; apply them.

Survey the codebase (existing features, tests, docs, config) and compare it to requirements + epic. Identify gaps before you emit tasks.

## Instructions

### Think first

- List what is already implemented versus what the epic still requires.
- Include ALL remaining work: features, integrations, tests, documentation, migrations, follow-ups.
- Do not emit `<status>complete</status>` unless the epic is actually done in the repo.
- Split work into the smallest tasks that can be implemented and QA'd independently. Order by dependencies (foundations first).
- When parallel Docker execution is enabled, prefer several small, independent backlog tasks. Tasks must not edit the same files concurrently.
- Preserve existing `id` values for tasks that represent the same intent. Assign new IDs starting from (max existing ID + 1).
- Exclude `"done"` and `"blocked"` tasks from the array.
- Every emitted `status` must be `"backlog"`.
- Each description must be implementation-ready: what and why, likely files or areas, approach, tests to add or run, and acceptance criteria a QA pass can check. No empty or one-sentence descriptions.

### Files

- You MAY append new, non-obvious learnings to `ralph/memory.md`.
- Do NOT write `ralph/task-status.json`. The loop engine parses your JSON and updates the Kanban.

### Parallel research (optional)

If you need extra investigation and the loop has parallel plan research enabled, you may emit one or more `<research-prompt>...</research-prompt>` blocks before the JSON. Each block is a self-contained research prompt. Still end with the task JSON.

## Output Format

The last thing in your response must be a fenced JSON array (numeric `id` values):

```json
[
  { "id": 6, "title": "Short task title", "description": "What/why, files, approach, tests, acceptance.", "status": "backlog" },
  { "id": 7, "title": "Another short title", "description": "Next implementation-ready description.", "status": "backlog" }
]
```

If all epic work is actually complete in the repo, output only:

<status>complete</status>

Use markdown only. Use only US English keyboard characters.

## Memory

After planning, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: codebase conventions, build/test commands, patterns, constraints. Do not duplicate entries already present.
