# Coding Agents & CLIs Available Models

Verified on **2026-11-05** against the installed WSL CLIs. Exact IDs are backend-specific.

Snapshot: **19 Cursor**, **16 Claude**, **17 Gemini**, **19 Copilot**, and **10 OpenCode Zen** entries, matching the catalog encoded in the app.

The shared catalog and these tables are synchronized. Availability can vary by account, provider, region, and CLI version. `Not reported` means pricing was not supplied by the verification source; it is not a free-usage claim. Saved custom model IDs remain supported.

Existing catalog choices are preserved while still listed. Known removed IDs are migrated to supported replacements; removed Copilot provider families without a listed successor use `auto`. Backend switching restores that backend's saved models, or its recommended defaults when no choices have been saved. Explicit CLI model overrides take precedence.

Reasoning effort: Copilot accepts `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, subject to each model's advertised subset. Claude accepts `low`, `medium`, `high`, `xhigh`, `max`, subject to model support. Cursor variants encode effort in the ID. Gemini and OpenCode do not receive a separate reasoning-effort flag from Ralph.

## Cursor Agent CLI

Curated from `cursor-agent models`, CLI 2026.10.22-27dcf5f. These 19 entries match the app's model choices. Older models and other effort/fast variants can be entered through Custom; saved model IDs are preserved. Reasoning/context/fast settings are encoded in each exact ID.

| Model                                 | ID                             | Strength                 | Tier              | Multiplier   | YOLO Mode | Fleet Mode         | Preferred For | Reasoning Effort |
| ------------------------------------- | ------------------------------ | ------------------------ | ----------------- | ------------ | --------- | ------------------ | ------------- | ---------------- |
| Auto (default)                        | auto                           | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Codex 5.3                             | gpt-5.3-codex                  | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Composer 2.5 (current)                | composer-2.5                   | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| GPT-5.6 Sol 1M High                   | gpt-5.6-sol-high               | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| GPT-5.6 Luna 1M High                  | gpt-5.6-luna-high              | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Grok 4.7  High                        | grok-4.7-high                  | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Composer 2.5 Fast                     | composer-2.5-fast              | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Claude Opus 5.5 1M High               | claude-opus-5-5-high           | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Gemini 4 Argon High                   | gemini-4-argon-high            | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Claude Fable 5.1 1M Thinking (NO ZDR) | claude-fable-5-1-thinking-high | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Gemini 3.8 Flash High                 | gemini-3.8-flash-high          | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Muse Spark 1.3 1M                     | muse-spark-1.3-high            | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| GPT-5.6 Terra 1M High                 | gpt-5.6-terra-high             | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Claude Sonnet 5.5  High               | claude-sonnet-5-5-high         | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) | Planning      | Encoded in ID    |
| GPT-5.4 Mini                          | gpt-5.4-mini-medium            | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) | Dev, QA       | Encoded in ID    |
| Claude Haiku 5.5  High                | claude-haiku-5-5-thinking-high | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| Kimi K3                               | kimi-k3-max                    | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| GLM 5.2                               | glm-5.2-high                   | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |
| DeepSeek V4.1 Flash 1017 High         | deepseek-v41-flash-1017-high   | Coding and agentic tasks | Account-dependent | Not reported | Yes       | Partial (Composer) |               | Encoded in ID    |

## Claude Code CLI

Claude Code 2.1.316 `--help` and bundled canonical model IDs. Includes Claude 4.5+ and newer Fable/Mythos families; this is not an account entitlement check. Restricted models may require additional provider access. Full IDs use hyphens; aliases such as `opus` and `sonnet` are also accepted as custom IDs.

| Model             | ID                | Strength                 | Tier              | Multiplier   | YOLO Mode                              | Fleet Mode          | Preferred For | Reasoning Effort |
| ----------------- | ----------------- | ------------------------ | ----------------- | ------------ | -------------------------------------- | ------------------- | ------------- | ---------------- |
| Claude Haiku 4.5  | claude-haiku-4-5  | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Haiku 5.5  | claude-haiku-5-5  | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Sonnet 4.5 | claude-sonnet-4-5 | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Sonnet 5   | claude-sonnet-5   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Sonnet 5.5 | claude-sonnet-5-5 | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Dev, QA       | Model-dependent  |
| Claude Opus 4.5   | claude-opus-4-5   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Opus 4.6   | claude-opus-4-6   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Opus 4.7   | claude-opus-4-7   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Opus 4.8   | claude-opus-4-8   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Opus 5     | claude-opus-5     | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Opus 5.5   | claude-opus-5-5   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) | Planning      | Model-dependent  |
| Claude Fable 5    | claude-fable-5    | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Fable 5.1  | claude-fable-5-1  | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Mythos 5   | claude-mythos-5   | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |
| Claude Mythos 5.1 | claude-mythos-5-1 | Coding and agentic tasks | Account-dependent | Not reported | Yes (`--dangerously-skip-permissions`) | Partial (subagents) |               | Model-dependent  |

## Gemini CLI

Gemini CLI 0.57.0 bundled `VALID_GEMINI_MODELS` and routing aliases. Excludes the `none` sentinel and embedding model. Preview, Gemma, and routing availability depends on authentication and provider policy.

| Model                                 | ID                                 | Strength                 | Tier              | Multiplier   | YOLO Mode | Fleet Mode | Preferred For | Reasoning Effort |
| ------------------------------------- | ---------------------------------- | ------------------------ | ----------------- | ------------ | --------- | ---------- | ------------- | ---------------- |
| Auto                                  | auto                               | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Auto Gemini 3                         | auto-gemini-3                      | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Auto Gemini 2.5                       | auto-gemini-2.5                    | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Pro (alias)                           | pro                                | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Flash (alias)                         | flash                              | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Flash Lite (alias)                    | flash-lite                         | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 2.5 Flash                      | gemini-2.5-flash                   | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 2.5 Pro                        | gemini-2.5-pro                     | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 3 Pro preview                  | gemini-3-pro-preview               | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 3.1 Pro preview                | gemini-3.1-pro-preview             | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         | Planning      | Not set by Ralph |
| Gemini 3.1 Pro preview (custom tools) | gemini-3.1-pro-preview-customtools | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 3 Flash preview                | gemini-3-flash-preview             | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 3.5 Flash                      | gemini-3.5-flash                   | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         | Dev, QA       | Not set by Ralph |
| Gemini 3 Flash                        | gemini-3-flash                     | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemini 3.1 Flash Lite                 | gemini-3.1-flash-lite              | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemma 4 31B IT                        | gemma-4-31b-it                     | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |
| Gemma 4 26B A4B IT                    | gemma-4-26b-a4b-it                 | Coding and agentic tasks | Account-dependent | Not reported | Yes       | No         |               | Not set by Ralph |

## GitHub Copilot CLI

GitHub Copilot CLI 1.0.105 authenticated JSON-RPC `models.list` response. Account-specific snapshot, no inference performed. Price categories and reasoning levels come from the API; old premium-request multipliers are not assumed current.

| Model                       | ID                   | Strength                                                                | Tier      | Multiplier   | YOLO Mode | Fleet Mode      | Preferred For | Reasoning Effort                    |
| --------------------------- | -------------------- | ----------------------------------------------------------------------- | --------- | ------------ | --------- | --------------- | ------------- | ----------------------------------- |
| Auto                        | auto                 | Automatic model routing                                                 | Varies    | Not reported | Yes       | Yes (`--fleet`) |               |                                     |
| Claude Sonnet 5.5           | claude-sonnet-5.5    | versatile                                                               | medium    | Not reported | Yes       | Yes (`--fleet`) | Dev, QA       | low, medium, high, xhigh, max       |
| Claude Sonnet 5             | claude-sonnet-5      | versatile                                                               | medium    | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Fable 5.1            | claude-fable-5.1     | powerful                                                                | very_high | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Opus 5.5             | claude-opus-5.5      | powerful                                                                | high      | Not reported | Yes       | Yes (`--fleet`) | Planning      | low, medium, high, xhigh, max       |
| Claude Opus 5               | claude-opus-5        | powerful; Claude Opus 5 has a planned deprecation date of 2026-11-16.   | high      | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Opus 4.8             | claude-opus-4.8      | powerful; Claude Opus 4.8 has a planned deprecation date of 2026-11-16. | high      | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Opus 4.8 (fast mode) | claude-opus-4.8-fast | powerful                                                                | very_high | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Haiku 5.5            | claude-haiku-5.5     | lightweight                                                             | low       | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| Claude Haiku 4.5            | claude-haiku-4.5     | lightweight                                                             | low       | Not reported | Yes       | Yes (`--fleet`) |               |                                     |
| GPT-6.1 Sol                 | gpt-6.1-sol          | powerful                                                                | medium    | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| GPT-6 Luna                  | gpt-6-luna           | lightweight                                                             | low       | Not reported | Yes       | Yes (`--fleet`) |               | none, low, medium, high, xhigh, max |
| GPT-6 Astra                 | gpt-6-astra          | powerful                                                                | very_high | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |
| GPT-5.6 Sol                 | gpt-5.6-sol          | powerful                                                                | high      | Not reported | Yes       | Yes (`--fleet`) |               | none, low, medium, high, xhigh, max |
| GPT-5.6 Terra               | gpt-5.6-terra        | versatile; GPT-5.6 Terra has a planned deprecation date of 2026-11-16.  | medium    | Not reported | Yes       | Yes (`--fleet`) |               | none, low, medium, high, xhigh, max |
| GPT-5.6 Luna                | gpt-5.6-luna         | lightweight                                                             | low       | Not reported | Yes       | Yes (`--fleet`) |               | none, low, medium, high, xhigh, max |
| GPT-5.3-Codex               | gpt-5.3-codex        | powerful                                                                | medium    | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh            |
| MAI-Code-1.1-Flash          | mai-code-1.1-flash   | lightweight                                                             | low       | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high                   |
| GPT-6.1 Terra               | gpt-6.1-terra        | versatile                                                               | low       | Not reported | Yes       | Yes (`--fleet`) |               | low, medium, high, xhigh, max       |

## OpenCode CLI

`opencode models`, OpenCode v2.0.31, filtered to the `opencode/` Zen provider. Other configured providers remain usable through Custom. The former positional provider filter is no longer accepted; `run --auto` replaces the old skip-permissions flag.

| Model                       | ID                                   | Strength                 | Tier             | Multiplier   | YOLO Mode      | Fleet Mode          | Preferred For | Reasoning Effort |
| --------------------------- | ------------------------------------ | ------------------------ | ---------------- | ------------ | -------------- | ------------------- | ------------- | ---------------- |
| Beam Free                   | opencode/beam-free                   | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| Big Pickle                  | opencode/big-pickle                  | Coding and agentic tasks | Provider-defined | Not reported | Yes (`--auto`) | Partial (subagents) | Planning      | Not set by Ralph |
| Crouton Alpha Free          | opencode/crouton-alpha-free          | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| DeepSeek V4.1 Flash Free    | opencode/deepseek-v4.1-flash-free    | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) | Dev, QA       | Not set by Ralph |
| Flint 40b Free              | opencode/flint-40b-free              | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| GLM 5.3 Flash Free          | opencode/glm-5.3-flash-free          | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| MiMo V2.6 Flash Free        | opencode/mimo-v2.6-flash-free        | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| Nemotron 3.5 Lightning Free | opencode/nemotron-3.5-lightning-free | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| Nemotron 3.5 Super VL Free  | opencode/nemotron-3.5-super-vl-free  | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
| Pulse Alpha Free            | opencode/pulse-alpha-free            | Coding and agentic tasks | Free             | Free         | Yes (`--auto`) | Partial (subagents) |               | Not set by Ralph |
