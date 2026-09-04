#!/bin/bash
set -euo pipefail

# Ralph launcher
# Builds the UI and starts the API server.
#
# Experiment under this repo (Kanban + --repo experiments/<slug>):
#   ./start.sh exp <slug>
#
# Example (headless run until epic complete):
# ./start.sh \
#   --repo /absolute/path/to/target-repo \
#   --plan-model claude-sonnet-4.6 \
#   --dev-model gpt-5-mini \
#   --qa-model gpt-5-mini \
#   --dev-reasoning-effort xhigh \
#   --qa-reasoning-effort high \
#   --max-llm-calls 300 \
#   --plan-frequency 1 \
#   --min-backlog-size 3 \
#   --auto-commit false \
#   --exit-when-complete

cd "$(dirname "$0")"

list_experiment_slugs() {
  local count=0
  for d in experiments/*/; do
    [ -d "$d" ] || continue
    local base="${d%/}"
    base="${base##*/}"
    if [ -f "${d}requirements.md" ] || [ -f "${d}REQUIREMENTS.md" ] || [ -f "${d}Requirements.md" ] \
      || [ -f "${d}docs/requirements.md" ] || [ -f "${d}docs/REQUIREMENTS.md" ]; then
      echo "  $base"
      count=$((count + 1))
    fi
  done
  if [ "$count" -eq 0 ]; then
    echo "  (none)"
  fi
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: ./start.sh [server-options]
       ./start.sh exp <slug> [server-options]

  exp <slug>    Start Ralph Kanban with --repo set to experiments/<slug> (absolute path).
                Then open http://localhost:3001 and run the loop from the UI (or pass --start).

Common options:
  --repo <path>                  Target repository (required with --start)
  --start                        Start loop after server boot
  --port <port>                  API/UI port (default: 3001)
  --exit-when-complete           Exit server when the loop finishes or errors

Settings overrides (persisted to ralph/settings.json):
  --plan-model <name>
  --dev-model <name>
  --qa-model <name>
  --agent-backend copilot|cursor-agent|claude|gemini|opencode
  --dev-reasoning-effort <level> (low|medium|high|xhigh)
  --qa-reasoning-effort <level>  (low|medium|high|xhigh)
  --max-llm-calls <n>
  --plan-frequency <n>
  --min-backlog-size <n>
  --agent-idle-timeout-minutes <n>  (0 disables; default 10)
  --agent-timeout-minutes <n>       (0 disables wall-clock cap)
  --auto-commit <true|false>
EOF
  exit 0
fi

if [ "${1:-}" = "exp" ]; then
  if [ -z "${2:-}" ]; then
    echo "Usage: ./start.sh exp <slug> [server-options...]"
    echo ""
    echo "Experiments (directories under experiments/ with a requirements file):"
    list_experiment_slugs
    exit 1
  fi
  slug="$2"
  shift 2
  repo="$(pwd)/experiments/${slug}"
  if [ ! -d "$repo" ]; then
    echo "error: no directory experiments/${slug}"
    exit 1
  fi
  set -- --repo "$repo" "$@"
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building web UI..."
npx vite build --config config/vite.config.ts

exec npx tsx src/server/index.ts "$@"
