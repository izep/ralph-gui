import { describe, expect, it } from "vitest";
import { normalizeLogTag, splitLogLine, tagKind } from "./logTags";

describe("normalizeLogTag", () => {
  it("maps legacy [system] to [ralph]", () => {
    expect(normalizeLogTag("[system]")).toBe("[ralph]");
    expect(normalizeLogTag("[ralph]")).toBe("[ralph]");
  });
});

describe("splitLogLine", () => {
  it("normalizes tags when splitting", () => {
    const { tag, body } = splitLogLine("[system] Ralph loop started");
    expect(tag).toBe("[ralph]");
    expect(body).toBe("Ralph loop started");
    expect(tagKind(tag, "[ralph] Ralph loop started")).toBe("ralph");
  });
});
