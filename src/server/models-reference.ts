// Route handlers for /models-reference and /api/agent-models
// Source of truth: src/shared/agent-models.ts (which mirrors docs/coding-agents-available-models.md)
import { AGENT_MODEL_CATALOG, PREFERRED_MODELS_BY_BACKEND, type AgentBackendId } from "../shared/agent-models.js";

export const BACKEND_DISPLAY_NAMES: Record<AgentBackendId, string> = {
  copilot: "GitHub Copilot CLI",
  "cursor-agent": "Cursor Agent",
  claude: "Claude Code CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode CLI",
};

export function buildModelsReferenceHtml(backend: AgentBackendId): string {
  const catalog = AGENT_MODEL_CATALOG[backend] ?? AGENT_MODEL_CATALOG["copilot"];
  const displayName = BACKEND_DISPLAY_NAMES[backend] ?? backend;
  const preferred = PREFERRED_MODELS_BY_BACKEND[backend] ?? PREFERRED_MODELS_BY_BACKEND["copilot"];

  const rows = catalog
    .map((m) => {
      const prefTags = m.preferredFor.map((p) => `<span class="pref-tag">${p}</span>`).join(" ");
      const isStar =
        preferred.planModel === m.id ||
        preferred.devModel === m.id ||
        preferred.qaModel === m.id;
      return `<tr>
        <td>${m.label}${isStar ? `<span class="star"> &#x2605;</span>` : ""}</td>
        <td><code>${m.id}</code></td>
        <td>${m.strength}</td>
        <td>${m.tier}</td>
        <td>${m.multiplier}</td>
        <td>${m.yoloMode}</td>
        <td>${m.fleetMode}</td>
        <td>${prefTags}</td>
      </tr>`;
    })
    .join("\n");

  const backendLinks = (Object.keys(BACKEND_DISPLAY_NAMES) as AgentBackendId[])
    .map((b) => `<a href="/models-reference?backend=${b}" class="${b === backend ? "active" : ""}">${BACKEND_DISPLAY_NAMES[b]}</a>`)
    .join(" | ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Models Reference &#x2014; ${displayName}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem 2rem; background: #0d1117; color: #e6edf3; }
    h1 { font-size: 1.3rem; margin-bottom: 0.5rem; }
    .nav { margin-bottom: 1.2rem; font-size: 0.9rem; }
    .nav a { color: #58a6ff; text-decoration: none; margin-right: 0.5rem; }
    .nav a.active { font-weight: bold; border-bottom: 2px solid #58a6ff; }
    .back { font-size: 0.85rem; color: #8b949e; margin-bottom: 0.8rem; display: block; }
    table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
    th { background: #161b22; color: #8b949e; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #30363d; }
    td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #21262d; vertical-align: top; }
    tr:hover td { background: #161b22; }
    code { background: #161b22; padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.82rem; }
    .pref-tag { background: #1f4e29; color: #56d364; border-radius: 4px; padding: 0.1em 0.5em; font-size: 0.78rem; margin-right: 2px; }
    .star { color: #f0c060; margin-left: 4px; }
  </style>
</head>
<body>
  <a class="back" href="/">&larr; Back to Ralph</a>
  <h1>Models Reference &#x2014; ${displayName}</h1>
  <div class="nav">${backendLinks}</div>
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>ID</th>
        <th>Strength</th>
        <th>Tier</th>
        <th>Multiplier</th>
        <th>YOLO Mode</th>
        <th>Fleet Mode</th>
        <th>Preferred For</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p style="margin-top:1.5rem;font-size:0.8rem;color:#8b949e;">
    Source: <a href="/docs/coding-agents-available-models.md" style="color:#58a6ff;">docs/coding-agents-available-models.md</a>
    &#x2014; Preferred plan: <strong>${preferred.planModel}</strong> | dev: <strong>${preferred.devModel}</strong> | qa: <strong>${preferred.qaModel}</strong>
  </p>
</body>
</html>`;
}
