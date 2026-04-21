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

## Planned: configurable agent CLI (plan / dev / QA)

Ralph shall support choosing which local CLI executes plan, dev, and QA iterations, with behavior equivalent to today’s Copilot-driven loop (same prompts, repo cwd, non-interactive execution, model strings passed through where the CLI supports them).

- [ ] Add a persisted setting (for example `agentBackend` or `agentCli`) with at least: **Copilot** (current default), **`cursor-agent`**, and **`claude`** (Anthropic Claude Code / `claude` CLI), stored in `ralph/settings.json` and surfaced in the Settings panel.
- [ ] Refactor the server-side caller so spawn arguments, stdin vs argv prompt delivery, and optional flags (for example yolo / print / approval bypass) are chosen per backend; resolve each executable via PATH with optional env overrides (for example `COPILOT_BIN`, `CURSOR_AGENT_BIN`, `CLAUDE_BIN`).
- [ ] Ensure command resolution and caches are correct when the user switches backend between loop iterations; document that model names are backend-specific.
- [ ] Map **reasoning effort** (and any Copilot-only flags) only where supported; otherwise ignore or document no-op behavior per backend.
- [ ] Extend automated tests for command resolution and caller wiring; extend `./start.sh` / server CLI overrides if flags are used for headless runs.
- [ ] Update [README.md](README.md) prerequisites and examples for non-Copilot backends.

## Last Updated

2026-04-16
