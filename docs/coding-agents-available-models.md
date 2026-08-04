# Coding Agents & CLIs Available Models

## Cursor Agent CLI

IDs from `cursor-agent models` (curated subset). Use exact `--model` values.

| Model                      | ID                               | Strength                                  | Tier       | Multiplier    | YOLO Mode | Fleet Mode         | Preferred For |
| -------------------------- | -------------------------------- | ----------------------------------------- | ---------- | ------------- | --------- | ------------------ | ------------- |
| Auto                       | auto                             | Cursor picks the best model               | Varies     | Varies        | Yes       | Partial (Composer) |
| Composer 2.5 Fast          | composer-2.5-fast                | Fast agentic coding (CLI default)         | Included   | Included      | Yes       | Partial (Composer) |
| GPT-5.4 Mini               | gpt-5.4-mini-medium              | Fast coding & reasoning                   | fast/cheap | Included      | Yes       | Partial (Composer) | Dev, QA       |
| GPT-5 Mini                 | gpt-5-mini                       | General-purpose + reasoning, fast         | fast/cheap | Included      | Yes       | Partial (Composer) |
| GPT-5.2 Codex              | gpt-5.2-codex                    | Code generation & review                  | standard   | medium        | Yes       | Partial (Composer) |
| GPT-5.3 Codex              | gpt-5.3-codex                    | Complex engineering, tests, refactors     | standard   | medium-high   | Yes       | Partial (Composer) |
| GPT-5.4                    | gpt-5.4-medium                   | Deep reasoning & multi-file tasks         | standard   | medium-high   | Yes       | Partial (Composer) |
| GPT-5.5                    | gpt-5.5-medium                   | Complex reasoning, most powerful GPT      | premium    | premium usage | Yes       | Partial (Composer) |
| Claude Sonnet 4.5          | claude-4.5-sonnet                | General-purpose, reasoning                | standard   | 1×            | Yes       | Partial (Composer) |
| Claude Sonnet 4.5 thinking | claude-4.5-sonnet-thinking       | Reasoning with extended thinking          | standard   | 1×            | Yes       | Partial (Composer) |
| Claude Sonnet 4.6          | claude-4.6-sonnet-medium         | General-purpose + deeper reasoning        | standard   | 1×            | Yes       | Partial (Composer) |
| Claude Sonnet 4.6 thinking | claude-4.6-sonnet-medium-thinking | Deeper reasoning with extended thinking    | standard   | 1×            | Yes       | Partial (Composer) |
| Claude Sonnet 5            | claude-sonnet-5-thinking-high    | Latest Sonnet, deep reasoning             | standard   | 1×            | Yes       | Partial (Composer) | Planning      |
| Claude Fable 5             | claude-fable-5-thinking-high     | Long-horizon agentic reasoning            | premium    | high          | Yes       | Partial (Composer) |
| Claude Opus 4.7            | claude-opus-4-7-high             | Deep reasoning, complex problems          | premium    | high          | Yes       | Partial (Composer) |
| Claude Opus 4.7 thinking   | claude-opus-4-7-thinking-xhigh   | Extended thinking, complex problems       | premium    | high          | Yes       | Partial (Composer) |
| Claude Opus 4.8            | claude-opus-4-8-thinking-high    | Anthropic's most powerful                 | premium    | high          | Yes       | Partial (Composer) |
| Gemini 3.5 Flash           | gemini-3.5-flash                 | Fast context processing                   | fast/cheap | Included      | Yes       | Partial (Composer) |
| Gemini 3 Flash             | gemini-3-flash                   | Fast context processing (prior gen)       | fast/cheap | Included      | Yes       | Partial (Composer) |
| Gemini 3.1 Pro             | gemini-3.1-pro                   | Massive context, advanced reasoning       | premium    | high          | Yes       | Partial (Composer) |

## Claude Code CLI

IDs use hyphens (`claude-sonnet-4-6`), not dots. Copilot uses dotted Anthropic IDs separately.

| Model             | ID                | Strength                           | Tier       | Multiplier | YOLO Mode                              | Fleet Mode | Preferred For |
| ----------------- | ----------------- | ---------------------------------- | ---------- | ---------- | -------------------------------------- | ---------- | ------------- |
| Claude Haiku 4.5  | claude-haiku-4-5  | Fast, lightweight tasks            | fast/cheap | low        | Yes (`--dangerously-skip-permissions`) | Yes        | Dev, QA       |
| Claude Sonnet 4.5 | claude-sonnet-4-5 | General-purpose, reasoning         | standard   | 1×         | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | General-purpose + deeper reasoning | standard   | 1×         | Yes (`--dangerously-skip-permissions`) | Yes        | Planning      |
| Claude Opus 4.5   | claude-opus-4-5   | Deep reasoning, complex problems   | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Opus 4.6   | claude-opus-4-6   | Deep reasoning (fast mode)         | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Opus 4.7   | claude-opus-4-7   | Anthropic's most powerful          | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |

## Gemini CLI

Use `-m` / `--model` with these IDs (`gemini-2.0-*` returns 404 on current CLI). Auto routing is via `/model` in interactive mode, not a separate ID.

| Model                  | ID                     | Strength                     | Tier       | Multiplier | YOLO Mode | Fleet Mode | Preferred For |
| ---------------------- | ---------------------- | ---------------------------- | ---------- | ---------- | --------- | ---------- | ------------- |
| Gemini 2.5 Flash       | gemini-2.5-flash       | Fast, lightweight context    | fast/cheap | low        | Yes       | No         |
| Gemini 2.5 Pro         | gemini-2.5-pro         | Deep reasoning, high context | standard   | medium     | Yes       | No         |
| Gemini 3 Flash preview | gemini-3-flash-preview | Fast (Gemini 3 family)       | fast/cheap | low        | Yes       | No         | Dev, QA       |
| Gemini 3 Pro preview   | gemini-3-pro-preview   | Complex reasoning (Gemini 3) | premium    | high       | Yes       | No         | Planning      |

## GitHub Copilot CLI

| Model             | ID                | Strength                                | Tier                | Multiplier   | YOLO Mode | Fleet Mode     | Preferred For |
| ----------------- | ----------------- | --------------------------------------- | ------------------- | ------------ | --------- | -------------- | ------------- |
| GPT-4.1           | gpt-4.1           | Fast, general-purpose coding            | Standard (included) | 0×           | Yes       | Yes (`/fleet`) |
| GPT-5 mini        | gpt-5-mini        | Reliable coding & writing, fast         | Standard (included) | 0×           | Yes       | Yes (`/fleet`) |
| GPT-5.4 mini      | gpt-5.4-mini      | Fast responses, lightweight code        | Standard (included) | ~0×          | Yes       | Yes (`/fleet`) | Dev, QA       |
| Claude Haiku 4.5  | claude-haiku-4.5  | Fastest Anthropic, simple tasks         | Standard (included) | ~0.25×       | Yes       | Yes (`/fleet`) |
| Claude Sonnet 4.5 | claude-sonnet-4.5 | Balanced reasoning & code               | Standard+           | ~1×          | Yes       | Yes (`/fleet`) |
| Claude Sonnet 4.6 | claude-sonnet-4.6 | Smarter reasoning, reliable completions | Standard+           | ~1×          | Yes       | Yes (`/fleet`) | Planning      |
| GPT-5.2           | gpt-5.2           | General reasoning                       | Standard+           | ~1×          | Yes       | Yes (`/fleet`) |
| GPT-5.2-Codex     | gpt-5.2-codex     | Code generation & review                | Standard+           | ~1×          | Yes       | Yes (`/fleet`) |
| GPT-5.3-Codex     | gpt-5.3-codex     | Complex engineering, tests, refactors   | Standard+           | ~2×          | Yes       | Yes (`/fleet`) |
| GPT-5.4           | gpt-5.4           | Deep reasoning, multi-file tasks        | Standard+           | ~2×          | Yes       | Yes (`/fleet`) |
| GPT-5.5           | gpt-5.5           | Complex reasoning & architecture        | Premium             | 7.5× (promo) | Yes       | Yes (`/fleet`) |
| Claude Opus 4.5   | claude-opus-4.5   | Anthropic flagship, deep reasoning      | Premium             | ~5×          | Yes       | Yes (`/fleet`) |
| Claude Opus 4.6   | claude-opus-4.6   | Improved Opus reasoning                 | Premium             | ~5×          | Yes       | Yes (`/fleet`) |
| Claude Opus 4.7   | claude-opus-4.7   | Most powerful Anthropic model           | Premium             | ~5×          | Yes       | Yes (`/fleet`) |

## OpenCode CLI

IDs from `opencode models opencode` (OpenCode Zen free tier). Use exact `-m` / `--model` values (`provider/model` format). No separate provider API key required — auth via OpenCode Zen (`/connect`).

| Model                  | ID                              | Strength                                   | Tier | Multiplier | YOLO Mode                              | Fleet Mode          | Preferred For |
| ---------------------- | ------------------------------- | ------------------------------------------ | ---- | ---------- | -------------------------------------- | ------------------- | ------------- |
| Big Pickle             | opencode/big-pickle             | Stealth coding-agent model (GLM-4.6 class) | Free | Free       | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Dev, Planning   |
| DeepSeek V4 Flash Free | opencode/deepseek-v4-flash-free | Fast DeepSeek V4 Flash, lightweight tasks  | Free | Free       | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Dev, QA       |
| MiMo-V2.5 Free         | opencode/mimo-v2.5-free         | Fast Xiaomi MiMo coding model              | Free | Free       | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Dev, QA       |
| Nemotron 3 Super Free  | opencode/nemotron-3-super-free  | NVIDIA Nemotron 3 Super (trial endpoints)  | Free | Free       | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Dev, QA       |
