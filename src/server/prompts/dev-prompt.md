# Task

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

If blocked, include explicit blocker metadata tags so the orchestrator can store structured blocker details in `task-status.json`.

Use this exact tag set (all required, and each on its own line):

```
<blocked-summary>short blocker summary</blocked-summary>
<blocked-impact>what this blocks and why</blocked-impact>
<blocked-next-step>single best next step to unblock</blocked-next-step>
<blocked-needs>missing dependency, access, or input needed</blocked-needs>
<status>blocked</status>
```

Full blocked response format:

```markdown
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
```

If the task is complete, clearly state that it is done using the following format:

```markdown
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
```
