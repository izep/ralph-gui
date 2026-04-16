# Epic: Configurable agent CLI for plan / dev / QA
## Summary
Deliver a user-selectable **agent backend** so the Ralph loop can run plan, dev, and QA iterations using **GitHub Copilot CLI** (today’s default), **`cursor-agent`**, or **`claude`** (Anthropic Claude Code CLI), with equivalent orchestration: same phase prompts, same repo working directory, and non-interactive execution suitable for the existing loop.
## Problem
Today the loop hard-codes Copilot CLI invocation. Operators who standardize on Cursor’s agent CLI or Claude Code cannot run the same plan → dev → QA cycle without swapping tools outside Ralph.
## Goals
1. **Setting + UI** — Persist a backend choice (e.g. `agentBackend`) in `ralph/settings.json`, expose it in the Settings panel, default to Copilot for backward compatibility.
2. **Caller behavior** — Centralize per-backend spawn: executable resolution (PATH + env overrides such as `COPILOT_BIN`, `CURSOR_AGENT_BIN`, `CLAUDE_BIN`), arguments, and prompt delivery (stdin vs argv) so plan, dev, and QA all use the selected backend.
3. **Correctness** — Command cache and resolution must stay consistent when the backend changes between iterations; model strings remain user-supplied and are **backend-specific** (documented, not validated by Ralph).
4. **Reasoning / flags** — Apply Copilot-only options (e.g. reasoning effort) only when the backend supports them; otherwise safe no-op or documented behavior.
5. **Quality + docs** — Tests for resolution and wiring; `./start.sh` / server CLI overrides where needed; README prerequisites and examples updated.
## Success criteria
- [ ] With backend set to Copilot, existing behavior is unchanged (regression-safe default).
- [ ] With backend set to `cursor-agent` or `claude`, a full plan → dev → QA iteration can complete when the corresponding CLI is installed, authenticated, and configured per vendor docs.
- [ ] Requirements in [requirements.md](requirements.md) under **Planned: configurable agent CLI** are satisfied (all checklist items done).
## Non-goals
- Hosting or billing for third-party CLIs; Ralph only spawns local processes.
- Unifying model catalogs across vendors or validating model IDs.
- Replacing or rewriting phase prompts unless a backend strictly requires prompt packaging (minimal adaptation only).
## Dependencies / assumptions
- Target machines have the chosen CLI on PATH or configured via env override.
- `requirements.md` remains the source of truth for product behavior; this epic implements the planned section dated 2026-04-16.
## Risks
- CLI flags and stdin/argv contracts differ by vendor; implementation must follow each tool’s current non-interactive mode and be covered by tests or documented manual verification steps where automation is impractical.