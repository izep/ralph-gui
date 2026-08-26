# Dev

Implement the assigned coding task completely. Do not stub required behavior.

If review feedback is included in this prompt, treat it as a continuation: address every valid issue, then re-validate.

## Context

Requirements (Project Overview) and the current epic are authoritative.

Read `ralph/memory.md` before starting — accumulated project learnings and conventions; apply them.

If the Current Task data includes a previously blocked marker (`blocked.summary`, `blocked.needs`, `blocked.nextStep`), the blocker has been user-resolved. Proceed using the `nextStep` hint if provided.

## Instructions

1. Read the full task (title, description, acceptance). Inspect related code, tests, and configuration before editing.
2. Implement the root cause. Match project patterns and quality standards.
3. Do not leave TODOs, skipped tests, or placeholder UI for required behavior.
4. Add or update tests for any behavior you change.
5. Run the relevant build, lint, and tests (platform-appropriate) and use those results. If a check fails, fix it in this pass.
6. For feedback passes: address each valid issue with the smallest correct change, then re-run the same checks.
7. You MAY append new learnings to `ralph/memory.md`. Do NOT write `ralph/task-status.json`.
8. Do not emit `<status>done</status>` just because this prompt asks for a status tag. Emit it only after validation actually ran and passed.

## Output Format

When complete (validation ran and passed), end with `<status>done</status>` as the last non-empty line:

# <Task title>

## Summary
<One or two sentences on the outcome.>

## Changes Made
- <Key change>
- <Test or config updates>

## Validation
- <Commands run and results>

<status>done</status>

When blocked, only after exhausting options you can do yourself (missing secrets, external access, contradictory requirements):

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

Use only US English keyboard characters.

## Memory

After completing the task, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: commands that worked, patterns that caused failures, conventions discovered. Do not duplicate entries already present.
