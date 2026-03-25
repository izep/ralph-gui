#!/bin/bash
set -euo pipefail

# Ralph launcher
# Builds the UI and starts the API server.
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

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: ./start.sh [server-options]

Common options:
  --repo <path>                  Target repository (required with --start)
  --start                        Start loop after server boot
  --port <port>                  API/UI port (default: 3001)
  --exit-when-complete           Exit server when epic completes

Settings overrides (persisted to ralph/settings.json):
  --plan-model <name>
  --dev-model <name>
  --qa-model <name>
  --dev-reasoning-effort <level> (low|medium|high|xhigh)
  --qa-reasoning-effort <level>  (low|medium|high|xhigh)
  --max-llm-calls <n>
  --plan-frequency <n>
  --min-backlog-size <n>
  --auto-commit <true|false>
EOF
  exit 0
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building web UI..."
npx vite build --config config/vite.config.ts

exec npx tsx src/server/index.ts "$@"
