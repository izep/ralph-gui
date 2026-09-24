import { describe, expect, it } from "vitest";
import { DEFAULT_LISTEN_PORT, resolveListenPort } from "./cli-args.js";

describe("resolveListenPort", () => {
  it("defaults to 3001 when neither CLI nor env is set", () => {
    expect(resolveListenPort()).toBe(DEFAULT_LISTEN_PORT);
    expect(resolveListenPort(undefined, undefined)).toBe(3001);
    expect(resolveListenPort(undefined, "")).toBe(3001);
  });

  it("uses PORT when --port is omitted", () => {
    expect(resolveListenPort(undefined, "3002")).toBe(3002);
  });

  it("lets --port win over PORT", () => {
    expect(resolveListenPort("4000", "3002")).toBe(4000);
  });

  it("accepts the edges of the valid range", () => {
    expect(resolveListenPort("1")).toBe(1);
    expect(resolveListenPort("65535")).toBe(65535);
  });

  it("throws on invalid --port", () => {
    expect(() => resolveListenPort("0")).toThrow(/Invalid --port "0"/);
    expect(() => resolveListenPort("65536")).toThrow(/Invalid --port "65536"/);
    expect(() => resolveListenPort("abc")).toThrow(/Invalid --port "abc"/);
    expect(() => resolveListenPort("3001.5")).toThrow(/Invalid --port "3001.5"/);
  });

  it("throws on invalid PORT when --port is omitted", () => {
    expect(() => resolveListenPort(undefined, "0")).toThrow(/Invalid PORT "0"/);
    expect(() => resolveListenPort(undefined, "nope")).toThrow(/Invalid PORT "nope"/);
  });
});
