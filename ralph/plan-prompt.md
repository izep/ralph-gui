# Task

Review the current project state, produce an updated task list as JSON output, and return the next task to implement.

## Step 1: Gather Context

- Read `ralph/task-status.json` to understand the current task inventory and what has already been completed.
- Read `requirements.md` first. Treat it as the authoritative source of product requirements and acceptance expectations.
- Read `README.md` and `ralph/epic.md` for implementation context and epic priority.
- Survey the codebase to understand what is already implemented and working.

## Step 2: Output the Updated Task List as JSON

Produce a JSON array of ALL tasks still needed to complete the project. Emit it as the FIRST block in your response, inside a fenced `json` code block.

Rules for building the task list:
- Include ALL remaining tasks: features, integrations, tests, documentation, and quality work required by the epic and requirements.
- Do NOT include tasks that are already `"done"` or `"blocked"`.
- Preserve existing `id` values when the same work is still needed.
- Assign new IDs for genuinely new tasks: start from (highest existing ID + 1) and increment for each.
- Order tasks by optimal implementation sequence, resolving dependencies first.
- Set `status` to `"backlog"` for every entry.
- Do NOT write any files. The loop engine is the sole writer of task-status.json.

Each task object must have exactly these four keys:
- `id`: integer
- `title`: short descriptive string (3-8 words)
- `description`: 1-2 sentence summary of the task
- `status`: `"backlog"`

## Step 3: Select and Describe the Next Task

Select the first `"backlog"` task from the updated list as the current task.

Write a full, implementation-ready description that includes:
- What needs to be done and why it matters
- Clear implementation guidance
- Testing steps
- Acceptance criteria

## Requirements

- Do not include implementation code in the task description.
- Be specific enough that a senior engineer can complete the task without further clarification.
- Follow the project's existing patterns, conventions, and quality standards.
- Ensure each planned task is traceable to `requirements.md` and supports delivering the current epic in `ralph/epic.md`.
- DO NOT modify completed or blocked tasks in any way. If additional work is needed related to a completed task, create a new task with a new ID.
- Do NOT write any files. The loop engine is the sole writer of task-status.json.
- Return markdown only.
- Use only characters available on a US English 101-key keyboard.

## Output Format

Your response must follow this exact structure:

1. A fenced JSON block (the first thing in your response) with the full updated task list:

```json
[
  { "id": 6, "title": "Short task title", "description": "One to two sentence description.", "status": "backlog" },
  { "id": 7, "title": "Another task title", "description": "Brief description.", "status": "backlog" }
]
```

2. The full implementation-ready task description prose (see Step 3).

3. A markdown section that mirrors the JSON task list titles in order (for backward compatibility):

```markdown
## Remaining Planned Tasks
- Task 1 title
- Task 2 title
- Task 3 title
```

4. The task ID signal at the very end:

```
<task-id>N</task-id>
```

Where `N` is the integer `id` of the task to implement next, and the remaining tasks list includes all `"backlog"` tasks in priority order.

## Completion Rule

If there are no remaining `"backlog"` tasks (the project is complete), output exactly:

```
<status>complete</status>
```
