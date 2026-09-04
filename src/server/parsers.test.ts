import { describe, it, expect } from "vitest";
import {
  parseTaskId,
  parseTaskTitle,
  parseTaskDescription,
  parseRemainingTasks,
  parseJsonTaskList,
  planOutputIsComplete,
  epicFrontmatterIsComplete,
  parseBlockedInfo,
} from "./parse-output.js";

// ---------------------------------------------------------------------------
// parseTaskId
// ---------------------------------------------------------------------------

describe("parseTaskId", () => {
  it("extracts an integer ID from <task-id>N</task-id>", () => {
    const content = "Some task description.\n\n<task-id>5</task-id>";
    expect(parseTaskId(content)).toBe(5);
  });

  it("returns null when no task-id signal is present", () => {
    expect(parseTaskId("No signal here.")).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(parseTaskId("")).toBeNull();
  });

  it("parses multi-digit IDs", () => {
    expect(parseTaskId("Done.\n<task-id>123</task-id>")).toBe(123);
  });

  it("parses ID at start of content", () => {
    expect(parseTaskId("<task-id>1</task-id>\nSome content.")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseTaskTitle
// ---------------------------------------------------------------------------

describe("parseTaskTitle", () => {
  it("extracts title from '## Task: ...' heading", () => {
    const content = "## Task: Add user authentication\nSome body text.";
    expect(parseTaskTitle(content, 1)).toBe("Add user authentication");
  });

  it("extracts title from a generic markdown heading when no Task: prefix", () => {
    const content = "# Implement caching layer\nMore details here.";
    expect(parseTaskTitle(content, 2)).toBe("Implement caching layer");
  });

  it("returns fallback when content has no headings", () => {
    const content = "Just some plain text without any headings.";
    expect(parseTaskTitle(content, 5)).toBe("Task 5");
  });

  it("trims whitespace from the title", () => {
    const content = "## Task:   Whitespace test   \nBody.";
    expect(parseTaskTitle(content, 1)).toBe("Whitespace test");
  });

  it("prefers '## Task:' over other headings", () => {
    const content = "# Generic Heading\n## Task: Specific Task\nBody.";
    expect(parseTaskTitle(content, 1)).toBe("Specific Task");
  });
});

// ---------------------------------------------------------------------------
// parseTaskDescription
// ---------------------------------------------------------------------------

describe("parseTaskDescription", () => {
  it("returns heading and body as description", () => {
    const content = "# My Task\nSome description text.";
    const result = parseTaskDescription(content);
    expect(result).toContain("# My Task");
    expect(result).toContain("Some description text.");
  });

  it("truncates description longer than 2000 chars", () => {
    const heading = "# Task\n";
    const longBody = "x".repeat(2100);
    const content = heading + longBody;
    const result = parseTaskDescription(content);
    expect(result.length).toBeLessThanOrEqual(2003); // 2000 + "..."
    expect(result).toMatch(/\.\.\.$/);
  });

  it("falls back to first 500 chars when no heading found", () => {
    const content = "No headings here, just text.\n".repeat(100);
    const result = parseTaskDescription(content);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("handles empty content", () => {
    expect(parseTaskDescription("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseRemainingTasks
// ---------------------------------------------------------------------------

describe("parseRemainingTasks", () => {
  it("parses remaining tasks from well-formed section", () => {
    const content = [
      "## Task: Current Task",
      "Some body.",
      "## Remaining Planned Tasks",
      "- Fix login bug",
      "- Add dark mode",
      "- Update docs",
    ].join("\n");

    const result = parseRemainingTasks(content);
    expect(result).toEqual(["Fix login bug", "Add dark mode", "Update docs"]);
  });

  it("returns empty array when section is missing", () => {
    const content = "## Task: Only one task\nNothing else.";
    expect(parseRemainingTasks(content)).toEqual([]);
  });

  it("returns empty array for empty content", () => {
    expect(parseRemainingTasks("")).toEqual([]);
  });

  it("trims whitespace from task names", () => {
    const content = [
      "## Remaining Planned Tasks",
      "-   Spaced task  ",
      "- Normal task",
    ].join("\n");
    const result = parseRemainingTasks(content);
    expect(result).toEqual(["Spaced task", "Normal task"]);
  });

  it("ignores lines that are not list items", () => {
    const content = [
      "## Remaining Planned Tasks",
      "- Valid task",
      "Some random text",
      "- Another valid task",
    ].join("\n");
    const result = parseRemainingTasks(content);
    // The regex captures consecutive "- " lines, so it stops at non-list text
    expect(result).toContain("Valid task");
  });
});

// ---------------------------------------------------------------------------
// parseJsonTaskList
// ---------------------------------------------------------------------------

describe("parseJsonTaskList", () => {
  it("parses a well-formed fenced JSON task array", () => {
    const tasks = [
      { id: 1, title: "Fix login bug", description: "Fix the auth flow", status: "backlog" },
      { id: 2, title: "Add dark mode", description: "Theme support", status: "backlog" },
    ];
    const content = "Some preamble.\n```json\n" + JSON.stringify(tasks) + "\n```\nSome epilogue.";
    const result = parseJsonTaskList(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, title: "Fix login bug", description: "Fix the auth flow", status: "backlog" });
    expect(result[1].id).toBe(2);
    expect(result[1].title).toBe("Add dark mode");
  });

  it("defaults description to empty string and status to backlog for minimal objects", () => {
    const tasks = [{ id: 5, title: "Minimal task" }];
    const content = "```json\n" + JSON.stringify(tasks) + "\n```";
    const result = parseJsonTaskList(content);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("");
    expect(result[0].status).toBe("backlog");
  });

  it("returns empty array when no fenced JSON block is present", () => {
    const content = "## Remaining Planned Tasks\n- Task A\n- Task B";
    expect(parseJsonTaskList(content)).toEqual([]);
  });

  it("parses an unlabeled fence", () => {
    const tasks = [{ id: 1, title: "Unlabeled", description: "d", status: "backlog" }];
    const content = "```\n" + JSON.stringify(tasks) + "\n```";
    expect(parseJsonTaskList(content)).toHaveLength(1);
    expect(parseJsonTaskList(content)[0].title).toBe("Unlabeled");
  });

  it("parses a fence that closes on the same line as the array", () => {
    const content = '```json\n[{"id":1,"title":"Same line","description":"d","status":"backlog"}]```';
    expect(parseJsonTaskList(content)[0]?.title).toBe("Same line");
  });

  it("coerces string ids to numbers", () => {
    const content = '```json\n[{"id":"3","title":"String id","description":"d","status":"backlog"}]\n```';
    expect(parseJsonTaskList(content)[0]).toMatchObject({ id: 3, title: "String id" });
  });

  it("strips trailing commas before parse", () => {
    const content = '```json\n[{"id":1,"title":"Trailing","description":"d","status":"backlog",}]\n```';
    expect(parseJsonTaskList(content)[0]?.title).toBe("Trailing");
  });

  it("parses a raw unfenced JSON array", () => {
    const content = 'Preamble\n[{"id":8,"title":"Raw array","description":"d","status":"backlog"}]\nThanks';
    expect(parseJsonTaskList(content)[0]?.title).toBe("Raw array");
  });

  it("prefers the last fenced array when several are present", () => {
    const first = '```json\n[{"id":1,"title":"First","description":"d","status":"backlog"}]\n```';
    const second = '```json\n[{"id":2,"title":"Second","description":"d","status":"backlog"}]\n```';
    expect(parseJsonTaskList(`${first}\n${second}`)[0]?.title).toBe("Second");
  });

  it("returns empty array when fenced block contains malformed JSON", () => {
    const content = "```json\n{ not valid json [\n```";
    expect(parseJsonTaskList(content)).toEqual([]);
  });

  it("returns empty array when fenced block contains a JSON object, not an array", () => {
    const content = "```json\n{\"id\": 1, \"title\": \"oops\"}\n```";
    expect(parseJsonTaskList(content)).toEqual([]);
  });

  it("skips entries missing id or title and returns only valid ones", () => {
    const tasks = [
      { id: 1, title: "Valid task" },
      { title: "Missing id" },
      { id: 3 },
      { id: 4, title: "Another valid" },
    ];
    const content = "```json\n" + JSON.stringify(tasks) + "\n```";
    const result = parseJsonTaskList(content);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(4);
  });

  it("handles a JSON fence label with uppercase JSON", () => {
    const tasks = [{ id: 10, title: "Uppercase fence", description: "Works", status: "backlog" }];
    const content = "```JSON\n" + JSON.stringify(tasks) + "\n```";
    const result = parseJsonTaskList(content);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Uppercase fence");
  });

  it("returns empty array for empty content", () => {
    expect(parseJsonTaskList("")).toEqual([]);
  });
});

describe("planOutputIsComplete", () => {
  it("detects the complete status tag", () => {
    expect(planOutputIsComplete("All done.\n<status>complete</status>\n")).toBe(true);
  });

  it("detects a fenced empty JSON array", () => {
    expect(planOutputIsComplete("```json\n[]\n```")).toBe(true);
  });

  it("does not treat missing JSON as complete", () => {
    expect(planOutputIsComplete("I planned some work but forgot the JSON.")).toBe(false);
  });

  it("does not treat a task array as complete", () => {
    expect(
      planOutputIsComplete(
        '```json\n[{"id":1,"title":"Work","description":"d","status":"backlog"}]\n```',
      ),
    ).toBe(false);
  });
});

describe("epicFrontmatterIsComplete", () => {
  it("reads status complete from YAML frontmatter", () => {
    const epic = `---
name: Example
status: complete
---

# Body
`;
    expect(epicFrontmatterIsComplete(epic)).toBe(true);
  });

  it("is false for pending epics", () => {
    expect(epicFrontmatterIsComplete("---\nstatus: pending\n---\n# Body\n")).toBe(false);
    expect(epicFrontmatterIsComplete("# No frontmatter\n")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseBlockedInfo
// ---------------------------------------------------------------------------

describe("parseBlockedInfo", () => {
  it("parses all blocker tags", () => {
    const content = [
      "# Task",
      "<blocked-summary>Need credentials</blocked-summary>",
      "<blocked-impact>Cannot call API</blocked-impact>",
      "<blocked-next-step>Provide token</blocked-next-step>",
      "<blocked-needs>Production API token</blocked-needs>",
      "<status>blocked</status>",
    ].join("\n");

    const result = parseBlockedInfo(content);
    expect(result).toEqual({
      summary: "Need credentials",
      impact: "Cannot call API",
      nextStep: "Provide token",
      needs: "Production API token",
    });
  });

  it("returns empty strings when tags are missing", () => {
    const result = parseBlockedInfo("<status>blocked</status>");
    expect(result).toEqual({
      summary: "",
      impact: "",
      nextStep: "",
      needs: "",
    });
  });
});
