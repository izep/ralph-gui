// Prompt templates loaded from src/server/prompts/*.md.
// When pointing at a new repo, these are written to <repo>/ralph/ if missing.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPrompt(name: string): string {
  return readFileSync(path.join(__dirname, "prompts", name), "utf-8");
}

export const PLAN_PROMPT = readPrompt("plan-prompt.md");
export const DEV_PROMPT = readPrompt("dev-prompt.md");
export const QA_PROMPT = readPrompt("qa-prompt.md");
export const MEMORY_MD = readPrompt("memory-template.md");

export const DEFAULT_EPIC = `# Current Epic

Describe the current epic Ralph should deliver.

Include:
- Business outcome
- Scope boundaries
- Non-goals
- Success criteria

Ralph uses this together with requirements.md to choose and prioritize tasks.
`;

// Re-export from the canonical source so existing imports keep working.
export { DEFAULT_SETTINGS } from "./settings-manager.js";