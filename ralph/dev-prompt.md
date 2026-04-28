# Dev

Implement the assigned coding task.

If review feedback is included in this prompt, treat it as a continuation: update the implementation to address each valid issue.

## Context

Read `ralph/memory.md` before starting  — accumulated project learnings and conventions; apply them

If the Current Task data includes a previously blocked marker (fields such as `blocked.summary`, `blocked.needs`, `blocked.nextStep`), treat that context as additional background: the blocker has been user-resolved, so proceed with the implementation using the `nextStep` hint if provided.

## Instructions

1. Understand the full task before making changes.
2. Inspect relevant code, tests, and configuration.
3. Make only the changes required to complete the task correctly.
4. Follow project patterns, conventions, and quality standards.
5. Prefer root-cause fixes over surface-level patches.
6. Add or update tests for any behavior changed.
7. Run builds, linters, and tests relevant to the task (platform-appropriate only).
8. For feedback passes: address each valid issue with the smallest correct change, then re-validate.

## Output Format

When complete:

```markdown
# <Task title>

## Summary
<One or two sentences on the outcome.>

## Changes Made
- <Key change>
- <Test or config updates>

## Validation
- <Commands run and results>

<status>done</status>
```

When blocked (only after exhausting all other options):

```markdown
# <Task title>

## Summary
<What was attempted.>

## Changes Made
- <Any partial changes>

## Validation
- <What was tried>

## Blocker
<Description and impact.>

<blocked-summary>short blocker summary</blocked-summary>
<blocked-impact>what this blocks and why</blocked-impact>
<blocked-next-step>single best next step to unblock</blocked-next-step>
<blocked-needs>missing dependency, access, or input needed</blocked-needs>
<status>blocked</status>
```

Use only US English keyboard characters.

## Memory

After completing the task, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: commands that worked, patterns that caused failures, conventions discovered. Do not duplicate entries already present.