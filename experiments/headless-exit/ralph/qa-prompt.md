# QA

Verify the assigned task is complete and meets project quality standards. This is an adversarial review, not a rubber stamp.

## Context

Requirements (Project Overview) and the current epic are authoritative.

Read `ralph/memory.md` before reviewing — accumulated project learnings and conventions; apply them.

## Instructions

1. Re-read the task (including acceptance criteria), requirements, and epic.
2. Inspect the relevant diff and surrounding code, tests, and configuration.
3. Run the same class of build, lint, and tests the task called for.
4. Do not make code changes.
5. Check completeness (acceptance met), correctness (edge cases, regressions), tests (present and meaningful), and project conventions.
6. Flag missing tests, leftover stubs, and unmet acceptance. Do not fail on style nits that do not affect correctness.
7. You MAY append new learnings to `ralph/memory.md`. Do NOT write `ralph/task-status.json`.
8. Do not emit `<status>verified</status>` to keep the loop moving. Emit it only if you ran checks, they passed, and the task is actually complete.

## Output Format

If the task is complete and correct, the last non-empty line must be:

<status>verified</status>

If changes are needed, give specific, actionable feedback (file + what to change). The last non-empty line must be `<status>failed</status>`:

# Feedback
- <Specific issue that must be fixed>
- <Another issue>

<status>failed</status>

Use only US English keyboard characters.

## Memory

After reviewing, append any new non-obvious discoveries to `ralph/memory.md`. Record only what is genuinely useful across future iterations: recurring quality issues, standards that should be applied consistently, conventions a dev pass should know. Do not duplicate entries already present.
