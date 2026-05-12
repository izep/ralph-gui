# Ralph - Requirements

## Overview

Ralph is a self-contained agentic coding loop that automates software development tasks. It uses GitHub Copilot CLI to run iterative plan -> dev -> QA cycles and exposes a Kanban board UI to monitor and control task progress in real time.

## System Architecture

- **kanban/** - The entire tool: React+TypeScript+Vite frontend, Express+WebSocket server, and the loop engine (all Node.js/TypeScript)
- **start.sh** - Bash entry point that builds the UI and starts the server

When pointed at a target repo via `--repo`, Ralph bootstraps a `ralph/` directory inside that repo with prompt templates, settings, goals, and status tracking files.

## Implemented Features

- [x] Kanban board UI with Backlog, In Progress, In QA, and Done columns
- [x] Live task status updates via WebSocket
- [x] Loop control (Start / Stop / Restart) from the browser
- [x] Settings panel for model selection (plan model, dev model, reasoning effort, max LLM calls)
- [x] Goals editor persisted to target repo's ralph/goals.md
- [x] Task status tracking persisted to target repo's ralph/task-status.json
- [x] Self-contained TypeScript loop engine (plan -> dev -> QA via Copilot CLI)
- [x] Output log viewer with stderr and system message highlighting
- [x] Error banner with restart and dismiss actions
- [x] Blocked task detection and badge display
- [x] Backlog task sync from plan output
- [x] Configurable target repo from the UI (--repo flag or Settings panel)
- [x] Requirements document gate (loop won't start without requirements.md)
- [x] Git branch display in settings
- [x] Auto-commit option after each verified task
- [x] Embedded prompt templates (bootstrapped per target repo)

## Implemented: configurable agent CLI (plan / dev / QA)

- [x] Persisted `agentBackend` setting in `ralph/settings.json`, with UI selection and default `copilot`
- [x] Server-side per-backend caller wiring for Copilot, Cursor Agent, Claude, and Gemini
- [x] Per-backend executable resolution with PATH lookup and env overrides (`COPILOT_BIN`, `CURSOR_AGENT_BIN`, `CLAUDE_BIN`, `GEMINI_BIN`)
- [x] Per-backend command caching and backend-specific invocation arguments
- [x] `--agent-backend` CLI override support for headless runs
- [x] Extended tests for backend normalization, command resolution, and call-path wiring
- [x] README prerequisites and examples updated for non-Copilot backends

## Planned follow-up

- [ ] Keep tracking backend-specific flag behavior as upstream CLIs evolve, and update docs/tests for any new safety-relevant defaults.

## Last Updated

2026-04-21
