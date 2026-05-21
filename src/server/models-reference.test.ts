import { describe, it, expect } from "vitest";
import { buildModelsReferenceHtml } from "./models-reference.js";
import { AGENT_MODEL_CATALOG, PREFERRED_MODELS_BY_BACKEND } from "../shared/agent-models.js";
import type { AgentBackendId } from "../shared/agent-models.js";

describe("buildModelsReferenceHtml", () => {
  it("contains all copilot model IDs in the HTML", () => {
    const html = buildModelsReferenceHtml("copilot");
    for (const entry of AGENT_MODEL_CATALOG["copilot"]) {
      expect(html).toContain(entry.id);
    }
  });

  it("contains all claude model IDs in the HTML", () => {
    const html = buildModelsReferenceHtml("claude");
    for (const entry of AGENT_MODEL_CATALOG["claude"]) {
      expect(html).toContain(entry.id);
    }
  });

  it("contains all gemini model IDs in the HTML", () => {
    const html = buildModelsReferenceHtml("gemini");
    for (const entry of AGENT_MODEL_CATALOG["gemini"]) {
      expect(html).toContain(entry.id);
    }
  });

  it("contains all cursor-agent model IDs in the HTML", () => {
    const html = buildModelsReferenceHtml("cursor-agent");
    for (const entry of AGENT_MODEL_CATALOG["cursor-agent"]) {
      expect(html).toContain(entry.id);
    }
  });

  it("includes preferred plan/dev/qa model IDs in the metadata line", () => {
    const backends: AgentBackendId[] = ["copilot", "claude", "gemini", "cursor-agent"];
    for (const backend of backends) {
      const html = buildModelsReferenceHtml(backend);
      const pref = PREFERRED_MODELS_BY_BACKEND[backend];
      expect(html).toContain(pref.planModel);
      expect(html).toContain(pref.devModel);
      expect(html).toContain(pref.qaModel);
    }
  });

  it("marks the selected backend as active in the nav", () => {
    const html = buildModelsReferenceHtml("claude");
    expect(html).toContain('class="active"');
    expect(html).toContain("Claude Code CLI");
  });

  it("includes a table header row", () => {
    const html = buildModelsReferenceHtml("copilot");
    expect(html).toContain("<th>Model</th>");
    expect(html).toContain("<th>ID</th>");
    expect(html).toContain("<th>Preferred For</th>");
  });

  it("defaults to copilot catalog when backend is unknown", () => {
    // Cast as unknown backend — fallback to copilot
    const html = buildModelsReferenceHtml("unknown-backend" as AgentBackendId);
    for (const entry of AGENT_MODEL_CATALOG["copilot"]) {
      expect(html).toContain(entry.id);
    }
  });
});
