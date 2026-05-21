import { describe, expect, it } from "vitest";
import {
  formatToolArgsJsonForDisplay,
  parsePlanResponseLine,
  parseToolLine,
} from "./parseToolLine";

describe("parseToolLine", () => {
  it("parses write_file and derives line count", () => {
    const body =
      `tool write_file {"path":"src/a.ts","content":"export const x = 1;\\n"}`;
    const r = parseToolLine(body);
    expect(r.kind).toBe("tool");
    if (r.kind === "tool") {
      expect(r.verb).toBe("write_file");
      expect(r.target).toBe("src/a.ts");
      expect(r.delta).toBe("+2 lines");
    }
  });

  it("parses list_dir with path", () => {
    const r = parseToolLine(`tool list_dir {"path":"."}`);
    expect(r.kind).toBe("tool");
    if (r.kind === "tool") {
      expect(r.verb).toBe("list_dir");
      expect(r.target).toBe(".");
    }
  });

  it("returns opaque for non-tool", () => {
    const r = parseToolLine("Some other line");
    expect(r.kind).toBe("opaque");
  });

  it("parses when olv nested tag precedes tool (real stderr body after [olv:phase] prefix)", () => {
    const r = parseToolLine(
      `[olv:tools] tool list_dir {"path":"."}`,
    );
    expect(r.kind).toBe("tool");
    if (r.kind === "tool") {
      expect(r.verb).toBe("list_dir");
      expect(r.target).toBe(".");
    }
  });

  it("treats empty list_dir path as current dir and shows depth in summary", () => {
    const r = parseToolLine(
      `tool list_dir {"path":"","depth":2}`,
    );
    expect(r.kind).toBe("tool");
    if (r.kind === "tool") {
      expect(r.verb).toBe("list_dir");
      expect(r.target).toBe(".");
      expect(r.delta).toBe("depth 2");
    }
  });
});

describe("formatToolArgsJsonForDisplay", () => {
  it("indents JSON for readability", () => {
    const s = formatToolArgsJsonForDisplay('{"a":1,"b":"x"}');
    expect(s).toContain("\n");
    expect(s).toContain('"a": 1');
  });
});

describe("parsePlanResponseLine", () => {
  it("extracts tasks from model envelope with fenced response", () => {
    const line =
      `[olv:plan:result] ${JSON.stringify({
        model: "m",
        response: "```json\n" +
          JSON.stringify([
            {
              id: 1,
              title: "First",
              status: "backlog",
            },
            {
              id: 2,
              title: "Second",
              status: "done",
            },
          ]) +
          "\n```\n",
      })}`;
    const r = parsePlanResponseLine(line);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("plan-response");
    if (r!.kind === "plan-response") {
      expect(r!.tasks).toHaveLength(2);
      expect(r!.tasks[0]!.id).toBe(1);
      expect(r!.tasks[1]!.title).toBe("Second");
    }
  });
});
