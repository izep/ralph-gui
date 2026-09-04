#!/usr/bin/env bash
# Stand-in for GitHub Copilot CLI. Prints a completed-plan JSONL event and exits.
# Extra argv from Ralph (`-p`, `--model`, …) is ignored.
printf '%s\n' '{"type":"assistant.message","data":{"content":"<status>complete</status>","toolRequests":[]}}'
exit 0
