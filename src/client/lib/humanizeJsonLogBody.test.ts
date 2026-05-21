import { describe, expect, it } from "vitest";
import {
  humanizeJsonLogBody,
  humanizeLogBody,
  humanizeReportIntentBody,
  looksLikeJson,
  looksLikeReportIntent,
} from "./humanizeJsonLogBody";

describe("looksLikeJson", () => {
  it("detects object and array bodies", () => {
    expect(looksLikeJson('{"a":1}')).toBe(true);
    expect(looksLikeJson("[1,2]")).toBe(true);
    expect(looksLikeJson("plain text")).toBe(false);
  });
});

describe("report_intent", () => {
  it("detects function-call syntax", () => {
    expect(looksLikeReportIntent('report_intent({"intent":"x"})')).toBe(true);
    expect(looksLikeReportIntent('{"intent":"x"}')).toBe(false);
  });

  it("humanizes intent string", () => {
    const r = humanizeReportIntentBody(
      'report_intent({"intent":"Inspecting source"})',
    );
    expect(r).toEqual({
      kind: "display",
      text: "Intent · Inspecting source",
      rawJson: '{"intent":"Inspecting source"}',
    });
  });

  it("humanizeLogBody prefers report_intent over generic json", () => {
    const r = humanizeLogBody(
      "[olv:dev]",
      'report_intent({"intent":"Reading specs"})',
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toBe("Intent · Reading specs");
    }
  });
});

describe("humanizeJsonLogBody", () => {
  it("summarizes OLV json envelope", () => {
    const r = humanizeJsonLogBody(
      "[olv:dev:stdout]",
      '{"model":"m","response":"hello world","done":true}',
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toMatch(/model m/);
      expect(r.text).toMatch(/hello world/);
      expect(r.rawJson).toBeDefined();
    }
  });

  it("shows turn complete for done envelope without response", () => {
    const r = humanizeJsonLogBody(
      "[olv:qa:stdout]",
      '{"model":"x","done":true}',
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toMatch(/Turn complete/);
    }
  });

  it("humanizes vibe assistant tool calls", () => {
    const r = humanizeJsonLogBody(
      "[vibe:dev]",
      JSON.stringify({
        role: "assistant",
        tool_calls: [{
          function: {
            name: "bash",
            arguments: JSON.stringify({ command: "npm test" }),
          },
        }],
      }),
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toContain("$ npm test");
    }
  });

  it("hides vibe system messages", () => {
    const r = humanizeJsonLogBody(
      "[vibe:plan]",
      JSON.stringify({ role: "system", content: "huge prompt" }),
    );
    expect(r).toEqual({ kind: "hidden" });
  });

  it("humanizes view() function call segment", () => {
    const r = humanizeLogBody(
      "[copilot:dev]",
      'view({"path":"/proj/output/src/App.tsx"})',
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toBe("read src/App.tsx");
    }
  });

  it("humanizes copilot tool execution start", () => {
    const r = humanizeJsonLogBody(
      "[copilot:dev]",
      JSON.stringify({
        type: "tool.execution_start",
        data: { toolName: "bash", arguments: { command: "ls" } },
      }),
    );
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toContain("$ ls");
    }
  });

  it("summarizes generic objects by key", () => {
    const r = humanizeJsonLogBody("[dev]", '{"status":"ok","count":3}');
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toContain("status: ok");
      expect(r.text).toContain("count: 3");
    }
  });

  it("returns truncated preview for invalid json", () => {
    const r = humanizeJsonLogBody("[olv:dev:stdout]", "{not json at all");
    expect(r?.kind).toBe("display");
    if (r?.kind === "display") {
      expect(r.text).toContain("not json");
    }
  });
});
