import type { AgentBackendId, AgentModelEntry, SavedModelsTriple } from './agent-models.js';

export const AGENT_MODEL_CATALOG: Record<AgentBackendId, AgentModelEntry[]> = {
  'copilot': [
    {"id":"auto","label":"Auto","strength":"Automatic model routing","tier":"Varies","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":[]},
    {"id":"claude-sonnet-5.5","label":"Claude Sonnet 5.5","strength":"versatile","tier":"medium","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":["Dev","QA"],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-sonnet-5","label":"Claude Sonnet 5","strength":"versatile","tier":"medium","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-fable-5.1","label":"Claude Fable 5.1","strength":"powerful","tier":"very_high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-opus-5.5","label":"Claude Opus 5.5","strength":"powerful","tier":"high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":["Planning"],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-opus-5","label":"Claude Opus 5","strength":"powerful; Claude Opus 5 has a planned deprecation date of 2026-11-16.","tier":"high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-opus-4.8","label":"Claude Opus 4.8","strength":"powerful; Claude Opus 4.8 has a planned deprecation date of 2026-11-16.","tier":"high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-opus-4.8-fast","label":"Claude Opus 4.8 (fast mode)","strength":"powerful","tier":"very_high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-haiku-5.5","label":"Claude Haiku 5.5","strength":"lightweight","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"claude-haiku-4.5","label":"Claude Haiku 4.5","strength":"lightweight","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":[]},
    {"id":"gpt-6.1-sol","label":"GPT-6.1 Sol","strength":"powerful","tier":"medium","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"gpt-6-luna","label":"GPT-6 Luna","strength":"lightweight","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["none","low","medium","high","xhigh","max"]},
    {"id":"gpt-6-astra","label":"GPT-6 Astra","strength":"powerful","tier":"very_high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
    {"id":"gpt-5.6-sol","label":"GPT-5.6 Sol","strength":"powerful","tier":"high","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["none","low","medium","high","xhigh","max"]},
    {"id":"gpt-5.6-terra","label":"GPT-5.6 Terra","strength":"versatile; GPT-5.6 Terra has a planned deprecation date of 2026-11-16.","tier":"medium","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["none","low","medium","high","xhigh","max"]},
    {"id":"gpt-5.6-luna","label":"GPT-5.6 Luna","strength":"lightweight","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["none","low","medium","high","xhigh","max"]},
    {"id":"gpt-5.3-codex","label":"GPT-5.3-Codex","strength":"powerful","tier":"medium","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh"]},
    {"id":"mai-code-1.1-flash","label":"MAI-Code-1.1-Flash","strength":"lightweight","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high"]},
    {"id":"gpt-6.1-terra","label":"GPT-6.1 Terra","strength":"versatile","tier":"low","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Yes (`--fleet`)","preferredFor":[],"reasoningEfforts":["low","medium","high","xhigh","max"]},
  ],

  'cursor-agent': [
    {"id":"auto","label":"Auto (default)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gpt-5.3-codex","label":"Codex 5.3","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"composer-2.5","label":"Composer 2.5 (current)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gpt-5.6-sol-high","label":"GPT-5.6 Sol 1M High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gpt-5.6-luna-high","label":"GPT-5.6 Luna 1M High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"grok-4.7-high","label":"Grok 4.7  High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"composer-2.5-fast","label":"Composer 2.5 Fast","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"claude-opus-5-5-high","label":"Claude Opus 5.5 1M High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gemini-4-argon-high","label":"Gemini 4 Argon High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"claude-fable-5-1-thinking-high","label":"Claude Fable 5.1 1M Thinking (NO ZDR)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gemini-3.8-flash-high","label":"Gemini 3.8 Flash High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"muse-spark-1.3-high","label":"Muse Spark 1.3 1M","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"gpt-5.6-terra-high","label":"GPT-5.6 Terra 1M High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"claude-sonnet-5-5-high","label":"Claude Sonnet 5.5  High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":["Planning"]},
    {"id":"gpt-5.4-mini-medium","label":"GPT-5.4 Mini","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":["Dev","QA"]},
    {"id":"claude-haiku-5-5-thinking-high","label":"Claude Haiku 5.5  High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"kimi-k3-max","label":"Kimi K3","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"glm-5.2-high","label":"GLM 5.2","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
    {"id":"deepseek-v41-flash-1017-high","label":"DeepSeek V4.1 Flash 1017 High","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"Partial (Composer)","preferredFor":[]},
  ],

  'claude': [
    {"id":"claude-haiku-4-5","label":"Claude Haiku 4.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-haiku-5-5","label":"Claude Haiku 5.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-sonnet-4-5","label":"Claude Sonnet 4.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-sonnet-4-6","label":"Claude Sonnet 4.6","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-sonnet-5","label":"Claude Sonnet 5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-sonnet-5-5","label":"Claude Sonnet 5.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":["Dev","QA"]},
    {"id":"claude-opus-4-5","label":"Claude Opus 4.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-opus-4-6","label":"Claude Opus 4.6","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-opus-4-7","label":"Claude Opus 4.7","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-opus-4-8","label":"Claude Opus 4.8","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-opus-5","label":"Claude Opus 5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-opus-5-5","label":"Claude Opus 5.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":["Planning"]},
    {"id":"claude-fable-5","label":"Claude Fable 5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-fable-5-1","label":"Claude Fable 5.1","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-mythos-5","label":"Claude Mythos 5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"claude-mythos-5-1","label":"Claude Mythos 5.1","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes (`--dangerously-skip-permissions`)","fleetMode":"Partial (subagents)","preferredFor":[]},
  ],

  'gemini': [
    {"id":"auto","label":"Auto","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"auto-gemini-3","label":"Auto Gemini 3","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"auto-gemini-2.5","label":"Auto Gemini 2.5","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"pro","label":"Pro (alias)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"flash","label":"Flash (alias)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"flash-lite","label":"Flash Lite (alias)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-2.5-flash","label":"Gemini 2.5 Flash","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-2.5-pro","label":"Gemini 2.5 Pro","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-3-pro-preview","label":"Gemini 3 Pro preview","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-3.1-pro-preview","label":"Gemini 3.1 Pro preview","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":["Planning"]},
    {"id":"gemini-3.1-pro-preview-customtools","label":"Gemini 3.1 Pro preview (custom tools)","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-3-flash-preview","label":"Gemini 3 Flash preview","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-3.5-flash","label":"Gemini 3.5 Flash","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":["Dev","QA"]},
    {"id":"gemini-3-flash","label":"Gemini 3 Flash","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemini-3.1-flash-lite","label":"Gemini 3.1 Flash Lite","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemma-4-31b-it","label":"Gemma 4 31B IT","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
    {"id":"gemma-4-26b-a4b-it","label":"Gemma 4 26B A4B IT","strength":"Coding and agentic tasks","tier":"Account-dependent","multiplier":"Not reported","yoloMode":"Yes","fleetMode":"No","preferredFor":[]},
  ],

  'opencode': [
    {"id":"opencode/beam-free","label":"Beam Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/big-pickle","label":"Big Pickle","strength":"Coding and agentic tasks","tier":"Provider-defined","multiplier":"Not reported","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":["Planning"]},
    {"id":"opencode/crouton-alpha-free","label":"Crouton Alpha Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/deepseek-v4.1-flash-free","label":"DeepSeek V4.1 Flash Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":["Dev","QA"]},
    {"id":"opencode/flint-40b-free","label":"Flint 40b Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/glm-5.3-flash-free","label":"GLM 5.3 Flash Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/mimo-v2.6-flash-free","label":"MiMo V2.6 Flash Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/nemotron-3.5-lightning-free","label":"Nemotron 3.5 Lightning Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/nemotron-3.5-super-vl-free","label":"Nemotron 3.5 Super VL Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
    {"id":"opencode/pulse-alpha-free","label":"Pulse Alpha Free","strength":"Coding and agentic tasks","tier":"Free","multiplier":"Free","yoloMode":"Yes (`--auto`)","fleetMode":"Partial (subagents)","preferredFor":[]},
  ],
};

export const PREFERRED_MODELS_BY_BACKEND: Record<AgentBackendId, SavedModelsTriple> = {
  "copilot": {
    "planModel": "claude-opus-5.5",
    "devModel": "claude-sonnet-5.5",
    "qaModel": "claude-sonnet-5.5"
  },
  "cursor-agent": {
    "planModel": "claude-sonnet-5-5-high",
    "devModel": "gpt-5.4-mini-medium",
    "qaModel": "gpt-5.4-mini-medium"
  },
  "claude": {
    "planModel": "claude-opus-5-5",
    "devModel": "claude-sonnet-5-5",
    "qaModel": "claude-sonnet-5-5"
  },
  "gemini": {
    "planModel": "gemini-3.1-pro-preview",
    "devModel": "gemini-3.5-flash",
    "qaModel": "gemini-3.5-flash"
  },
  "opencode": {
    "planModel": "opencode/big-pickle",
    "devModel": "opencode/deepseek-v4.1-flash-free",
    "qaModel": "opencode/deepseek-v4.1-flash-free"
  }
};
