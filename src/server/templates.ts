// Prompt templates embedded as constants so the tool is fully self-contained.
// When pointing at a new repo, these are written to <repo>/ralph/ if missing.

export const PLAN_PROMPT = `# Task

Review the current project state, produce an updated task list as JSON output, and return the next task to implement.

## Step 1: Gather Context

- Read \`ralph/task-status.json\` to understand the current task inventory and what has already been completed.
- Read \`requirements.md\` first. Treat it as the authoritative source of product requirements and acceptance expectations.
- Read \`README.md\` and \`ralph/epic.md\` for implementation context and epic priority.
- Survey the codebase to understand what is already implemented and working.

## Step 2: Output the Updated Task List as JSON

Produce a JSON array of ALL tasks still needed to complete the project. Emit it as the FIRST block in your response, inside a fenced \`json\` code block.

Rules for building the task list:
- Include ALL remaining tasks: features, integrations, tests, documentation, and quality work required by the epic and requirements.
- Do NOT include tasks that are already \`"done"\` or \`"blocked"\`.
- Preserve existing \`id\` values when the same work is still needed.
- Assign new IDs for genuinely new tasks: start from (highest existing ID + 1) and increment for each.
- Order tasks by optimal implementation sequence, resolving dependencies first.
- Set \`status\` to \`"backlog"\` for every entry.
- Do NOT write any files. The loop engine is the sole writer of task-status.json.

Each task object must have exactly these four keys:
- \`id\`: integer
- \`title\`: short descriptive string (3-8 words)
- \`description\`: 1-2 sentence summary of the task
- \`status\`: \`"backlog"\`

## Step 3: Select and Describe the Next Task

Select the first \`"backlog"\` task from the updated list as the current task.

Write a full, implementation-ready description that includes:
- What needs to be done and why it matters
- Clear implementation guidance
- Testing steps
- Acceptance criteria

## Requirements

- Do not include implementation code in the task description.
- Be specific enough that a senior engineer can complete the task without further clarification.
- Follow the project's existing patterns, conventions, and quality standards.
- Ensure each planned task is traceable to \`requirements.md\` and supports delivering the current epic in \`ralph/epic.md\`.
- DO NOT modify completed or blocked tasks in any way. If additional work is needed related to a completed task, create a new task with a new ID.
- Do NOT write any files. The loop engine is the sole writer of task-status.json.
- Return markdown only.
- Use only characters available on a US English 101-key keyboard.

## Output Format

Your response must follow this exact structure:

1. A fenced JSON block (the first thing in your response) with the full updated task list:

\`\`\`json
[
  { "id": 6, "title": "Short task title", "description": "One to two sentence description.", "status": "backlog" },
  { "id": 7, "title": "Another task title", "description": "Brief description.", "status": "backlog" }
]
\`\`\`

2. The full implementation-ready task description prose (see Step 3).

3. A markdown section that mirrors the JSON task list titles in order (for backward compatibility):

\`\`\`markdown
## Remaining Planned Tasks
- Task 1 title
- Task 2 title
- Task 3 title
\`\`\`

4. The task ID signal at the very end:

\`\`\`
<task-id>N</task-id>
\`\`\`

Where \`N\` is the integer \`id\` of the task to implement next, and the remaining tasks list includes all \`"backlog"\` tasks in priority order.

## Completion Rule

If there are no remaining \`"backlog"\` tasks (the project is complete), output exactly:

\`\`\`
<status>complete</status>
\`\`\`
`;

export const DEV_PROMPT = `# Task

Implement the assigned coding task in the project.

After the initial implementation is complete, you may receive review feedback. If feedback is provided, treat it as a continuation of the same task and update the implementation until the task is fully complete. For multiplatform projects, ensure that any platform-specific code is properly organized and does not cause build errors on other platforms. Run the tests/builds that the current platform will support.

## Requirements

- Understand the assigned task before making changes.
- Inspect any relevant code, documentation, configuration, or tests as needed.
- Make only the changes required to complete the task correctly.
- Follow the project's existing patterns, conventions, and quality standards.
- Prefer root-cause fixes over surface-level patches.
- Add or update tests when needed to verify the behavior you changed.
- Run builds, linters, and tests that are relevant to the task.
- If review feedback is provided later, address each valid issue with the smallest correct change.
- Do not ignore feedback that identifies a real correctness, quality, or testing gap.

## Workflow

## Initial Pass

- Implement the assigned task.
- Validate the result with the appropriate tests, builds, or linters.
- Summarize what changed and how it was verified.

## Feedback Pass

- Review any feedback carefully.
- Determine which items are valid and require changes.
- Update the implementation to resolve the valid feedback.
- Re-run the relevant validation steps.
- Summarize the follow-up changes and the final verification.

## Output Rules

- Use only characters available on a US English 101-key keyboard.
- Be concise, but include enough detail to explain what changed and how it was validated.
- If blocked, clearly state the blocker and the minimum information or action needed to continue. Considering the task as blocked should be after all other options to resolve the issue have been exhausted.

## Suggested Response Structure

If blocked, include explicit blocker metadata tags so the orchestrator can store structured blocker details in \`task-status.json\`.

Use this exact tag set (all required, and each on its own line):

\`\`\`
<blocked-summary>short blocker summary</blocked-summary>
<blocked-impact>what this blocks and why</blocked-impact>
<blocked-next-step>single best next step to unblock</blocked-next-step>
<blocked-needs>missing dependency, access, or input needed</blocked-needs>
<status>blocked</status>
\`\`\`

Full blocked response format:

\`\`\`markdown
# Task Name or brief description of the task.

## Summary
- Brief description of the task outcome.

## Changes Made
- Key implementation change.
- Any test or configuration updates.

## Validation
- Build, lint, or test commands that were run.
- Result of each relevant validation step.

## Blocker
- Description of the blocker and its impact on the task.
- Minimum information or action needed to resolve the blocker and continue with the task.

<blocked-summary>short blocker summary</blocked-summary>
<blocked-impact>what this blocks and why</blocked-impact>
<blocked-next-step>single best next step to unblock</blocked-next-step>
<blocked-needs>missing dependency, access, or input needed</blocked-needs>
<status>blocked</status>
\`\`\`

If the task is complete, clearly state that it is done using the following format:

\`\`\`markdown
# Task Name or brief description of the task.
## Summary
- Brief description of the task outcome.

## Changes Made
- Key implementation change.
- Any test or configuration updates.

## Validation
- Build, lint, or test commands that were run.
- Result of each relevant validation step.

<status>done</status>
\`\`\`
`;

export const QA_PROMPT = `# Task

Review the assigned task and evaluate whether the implementation is complete and meets the required quality standard.

## Requirements

- Understand the assigned task before reviewing the code.
- Inspect any relevant code, documentation, configuration, or tests as needed.
- Run builds, linters, and tests when useful to verify correctness.
- Do not make code changes.
- Provide feedback only when it is meaningful and necessary to complete the task correctly or to meet project quality standards.
- Focus on correctness, completeness, code quality, testing, and adherence to project conventions.

## Output Rules

- If the task is implemented correctly and no changes are required, output only:

\`\`\`
<status>verified</status>
\`\`\`

- Otherwise, provide markdown feedback that clearly explains what is still wrong or missing so the task can be completed correctly.
- Use only characters available on a US English 101-key keyboard.

## Example Verified Output

\`\`\`
<status>verified</status>
\`\`\`

## Example Feedback Output

\`\`\`markdown
# Feedback
The code does not meet the requirements of the assigned task for the following reasons:

- The function \`calculateTotal\` does not handle the case where the input array is empty, which can lead to errors.
- The variable naming in \`processData\` is not descriptive enough to make the intent of the code clear.
- There are no unit tests for \`fetchData\`, which is necessary to verify reliability.
- The code does not follow project conventions such as camelCase naming and documenting non-obvious logic.
- Build or lint errors remain and must be resolved before the task can be considered complete.
- Unit test failures remain and must be addressed.
- The business logic is incorrect because \`calculateDiscount\` does not apply the expected discount rates.
\`\`\`
`;

export const DEFAULT_EPIC = `# Current Epic

Describe the current epic Ralph should deliver.

Include:
- Business outcome
- Scope boundaries
- Non-goals
- Success criteria

Ralph uses this together with requirements.md to choose and prioritize tasks.
`;

// Re-export from the canonical source so existing imports keep working.
export { DEFAULT_SETTINGS } from "./settings-manager.js";
