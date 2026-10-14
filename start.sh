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
#   --port 3001 \
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
#
# Second instance (after a first build): --skip-build --port 3002 --repo /other/repo

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
  --port <port>                  API/UI port (default: 3001, or PORT env)
  --skip-build                   Skip vite build (requires dist/index.html)
  --exit-when-complete           Exit server when the loop finishes or errors

  Use a unique --repo per instance. Two loops on the same repo are refused
  (ralph/loop.lock). If --port and PORT are omitted, a free port is chosen
  starting at 3001. After the first build, pass --skip-build so concurrent
  launches do not race on dist/.

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

SKIP_BUILD=0
filtered=()
for arg in "$@"; do
  if [ "$arg" = "--skip-build" ]; then
    SKIP_BUILD=1
  else
    filtered+=("$arg")
  fi
done
set -- "${filtered[@]}"

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

if [ "$SKIP_BUILD" -eq 1 ]; then
  if [ ! -f dist/index.html ]; then
    echo "error: --skip-build requires dist/index.html (run without --skip-build first)"
    exit 1
  fi
  echo "Skipping UI build (--skip-build)."
else
  echo "Building web UI..."
  flock .ralph-gui-build.lock npx vite build --config config/vite.config.ts
fi

exec npx tsx src/server/index.ts "$@"
