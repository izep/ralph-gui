# Coding Agents & CLIs Available Models

## Cursor

| Model             | ID                | Strength                             | Tier       | Multiplier    | YOLO Mode | Fleet Mode         | Preferred For |
| ----------------- | ----------------- | ------------------------------------ | ---------- | ------------- | --------- | ------------------ | ------------- |
| Cursor Small      | cursor-small      | Fast code completions                | fast/cheap | Included      | Yes       | Partial (Composer) |
| Claude Haiku 4.5  | claude-haiku-4.5  | Fast, lightweight tasks              | fast/cheap | low           | Yes       | Partial (Composer) |
| Claude Sonnet 4.5 | claude-sonnet-4.5 | General-purpose, reasoning           | standard   | 1x ✓          | Yes       | Partial (Composer) |
| Claude Sonnet 4.6 | claude-sonnet-4.6 | General-purpose + deeper reasoning   | standard   | 1x ✓          | Yes       | Partial (Composer) | Planning      |
| Claude Opus 4.7   | claude-opus-4.7   | Anthropic's most powerful            | premium    | high          | Yes       | Partial (Composer) |
| GPT-4.1           | gpt-4.1           | Fast code completions                | fast/cheap | Included      | Yes       | Partial (Composer) |
| GPT-5 mini        | gpt-5-mini        | General-purpose + reasoning          | fast/cheap | Included      | Yes       | Partial (Composer) | Dev, QA       |
| GPT-5.4           | gpt-5.4           | Deep reasoning & debugging           | standard   | medium-high   | Yes       | Partial (Composer) |
| GPT-5.5           | gpt-5.5           | Complex reasoning, most powerful GPT | premium    | premium usage | Yes       | Partial (Composer) |
| Gemini 2.0 Flash  | gemini-2.0-flash  | Fast context processing              | fast/cheap | Included      | Yes       | Partial (Composer) |
| Gemini 2.0 Pro    | gemini-2.0-pro    | Massive context, advanced reasoning  | premium    | high          | Yes       | Partial (Composer) |

## Claude Code CLI

| Model             | ID                | Strength                           | Tier       | Multiplier | YOLO Mode                              | Fleet Mode | Preferred For |
| ----------------- | ----------------- | ---------------------------------- | ---------- | ---------- | -------------------------------------- | ---------- | ------------- |
| Claude Haiku 4.5  | claude-haiku-4.5  | Fast, lightweight tasks            | fast/cheap | low        | Yes (`--dangerously-skip-permissions`) | Yes        | Dev, QA       |
| Claude Sonnet 4.5 | claude-sonnet-4.5 | General-purpose, reasoning         | standard   | 1x ✓       | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Sonnet 4.6 | claude-sonnet-4.6 | General-purpose + deeper reasoning | standard   | 1x ✓       | Yes (`--dangerously-skip-permissions`) | Yes        | Planning      |
| Claude Opus 4.5   | claude-opus-4.5   | Deep reasoning, complex problems   | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Opus 4.6   | claude-opus-4.6   | Deep reasoning (fast mode)         | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |
| Claude Opus 4.7   | claude-opus-4.7   | Anthropic's most powerful          | premium    | high       | Yes (`--dangerously-skip-permissions`) | Yes        |

## Gemini CLI

| Model            | ID               | Strength                     | Tier       | Multiplier | YOLO Mode | Fleet Mode | Preferred For |
| ---------------- | ---------------- | ---------------------------- | ---------- | ---------- | --------- | ---------- | ------------- |
| Gemini 1.5 Pro   | gemini-1.5-pro   | Massive context reasoning    | standard   | medium     | Yes       | No         |
| Gemini 2.0 Flash | gemini-2.0-flash | Fast, lightweight context    | fast/cheap | low        | Yes       | No         | Dev, QA       |
| Gemini 2.0 Pro   | gemini-2.0-pro   | Deep reasoning, high context | premium    | high       | Yes       | No         |
| Gemini 2.0 Auto  | gemini-2.0-auto  | Auto routing, task-based     | standard   | medium     | Yes       | No         | Planning      |

## GitHub Copilot CLI

| Model         | ID            | Strength                             | Tier       | Multiplier      | YOLO Mode | Fleet Mode     | Preferred For |
| ------------- | ------------- | ------------------------------------ | ---------- | --------------- | --------- | -------------- | ------------- |
| GPT-4.1       | gpt-4.1       | Fast code completions                | fast/cheap | 0x ✓ (included) | Yes       | Yes (`/fleet`) |
| GPT-5 mini    | gpt-5-mini    | General-purpose + reasoning          | fast/cheap | 0x ✓ (included) | Yes       | Yes (`/fleet`) |
| GPT-5.2       | gpt-5.2       | Deep reasoning & debugging           | standard   | medium          | Yes       | Yes (`/fleet`) |
| GPT-5.2-Codex | gpt-5.2-codex | Agentic software development         | standard   | medium          | Yes       | Yes (`/fleet`) |
| GPT-5.3-Codex | gpt-5.3-codex | Agentic tasks (higher quality)       | standard   | medium          | Yes       | Yes (`/fleet`) |
| GPT-5.4       | gpt-5.4       | Deep reasoning & debugging           | standard   | medium-high     | Yes       | Yes (`/fleet`) | Planning      |
| GPT-5.4 mini  | gpt-5.4-mini  | Agentic + codebase exploration       | fast/cheap | low             | Yes       | Yes (`/fleet`) | Dev, QA       |
| GPT-5.5       | gpt-5.5       | Complex reasoning, most powerful GPT | premium    | 7.5x ✓ (promo)  | Yes       | Yes (`/fleet`) |
