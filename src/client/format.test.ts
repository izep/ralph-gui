import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo } from "./format";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for empty input", () => {
    expect(timeAgo("")).toBe("");
  });

  it('returns "just now" for very recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
    expect(timeAgo("2026-03-23T12:00:00Z")).toBe("just now");
  });

  it("returns minutes for timestamps less than an hour ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:30:00Z"));
    expect(timeAgo("2026-03-23T12:00:00Z")).toBe("30m ago");
  });

  it("returns hours for timestamps less than a day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T15:00:00Z"));
    expect(timeAgo("2026-03-23T12:00:00Z")).toBe("3h ago");
  });

  it("returns days for timestamps more than a day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"));
    expect(timeAgo("2026-03-23T12:00:00Z")).toBe("2d ago");
  });
});
