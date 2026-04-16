# Task

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

```
<status>verified</status>
```

- Otherwise, provide markdown feedback that clearly explains what is still wrong or missing so the task can be completed correctly.
- Use only characters available on a US English 101-key keyboard.

## Example Verified Output

```
<status>verified</status>
```

## Example Feedback Output

```markdown
# Feedback
The code does not meet the requirements of the assigned task for the following reasons:

- The function `calculateTotal` does not handle the case where the input array is empty, which can lead to errors.
- The variable naming in `processData` is not descriptive enough to make the intent of the code clear.
- There are no unit tests for `fetchData`, which is necessary to verify reliability.
- The code does not follow project conventions such as camelCase naming and documenting non-obvious logic.
- Build or lint errors remain and must be resolved before the task can be considered complete.
- Unit test failures remain and must be addressed.
- The business logic is incorrect because `calculateDiscount` does not apply the expected discount rates.
```
