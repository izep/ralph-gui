import { describe, expect, it } from "vitest";
import {
  formatCopilotToolRequest,
  humanizeCombinedCopilotBody,
  humanizeCopilotLogSegment,
  normalizeCopilotOutputFormat,
  summarizeCopilotToolResult,
} from "./copilotLogFormat.js";

describe("normalizeCopilotOutputFormat", () => {
  it("accepts known values and defaults invalid to streaming", () => {
    expect(normalizeCopilotOutputFormat("json")).toBe("json");
    expect(normalizeCopilotOutputFormat("TEXT")).toBe("text");
    expect(normalizeCopilotOutputFormat("bogus")).toBe("streaming");
    expect(normalizeCopilotOutputFormat(undefined)).toBe("streaming");
  });
});

describe("formatCopilotToolRequest", () => {
  it("formats view and create by path", () => {
    expect(
      formatCopilotToolRequest("view", {
        path: "/proj/output/src/App.tsx",
      }),
    ).toBe("read src/App.tsx");
    expect(
      formatCopilotToolRequest("create", {
        path: "/proj/output/src/types.ts",
      }),
    ).toBe("write src/types.ts");
  });

  it("formats report_intent", () => {
    expect(
      formatCopilotToolRequest("report_intent", {
        intent: "Inspecting source",
      }),
    ).toBe("Intent · Inspecting source");
  });
});

describe("summarizeCopilotToolResult", () => {
  it("summarizes diff --git output", () => {
    const s = summarizeCopilotToolResult(
      "diff --git a/foo/output/src/App.tsx b/foo/output/src/App.tsx",
    );
    expect(s).toContain("read");
    expect(s).toContain("App.tsx");
    expect(s).not.toContain("diff --git");
  });

  it("summarizes tasks json", () => {
    const s = summarizeCopilotToolResult(
      '{"tasks":[{"id":1,"title":"A","status":"backlog"}]}',
    );
    expect(s).toMatch(/tasks · 1/);
  });
});

describe("humanizeCombinedCopilotBody", () => {
  it("humanizes each segment in a combined line", () => {
    const out = humanizeCombinedCopilotBody(
      'report_intent({"intent":"Survey"}) · view({"path":"/p/out"})',
    );
    expect(out).toContain("Intent · Survey");
    expect(out).toContain("read p/out");
    expect(out).not.toContain("view({");
  });
});

describe("humanizeCopilotLogSegment", () => {
  it("passes through shell commands", () => {
    expect(humanizeCopilotLogSegment("$ npm test")).toBe("$ npm test");
  });
});
