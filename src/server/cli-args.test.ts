import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LISTEN_PORT, resolveListenPort } from "./cli-args.js";
import { DEFAULT_SETTINGS } from "./settings-manager.js";
import { getPreferredModels } from "../shared/agent-models.js";

describe("CLI model settings", () => {
  it("restores backend-specific models and lets explicit model overrides win", async () => {
    const originalArgv = process.argv;
    try {
      process.argv = ["node", "index.ts", "--agent-backend", "claude", "--dev-model", "custom/model", "--qa-reasoning-effort", "max"];
      vi.resetModules();
      const { applyCliSettingsOverrides } = await import("./cli-args.js");
      const writeSettings = vi.fn();
      await applyCliSettingsOverrides({
        readSettings: async () => ({ ...DEFAULT_SETTINGS, savedModelsByBackend: {} }),
        writeSettings,
      });
      expect(writeSettings).toHaveBeenCalledWith(expect.objectContaining({
        agentBackend: "claude",
        planModel: getPreferredModels("claude").planModel,
        devModel: "custom/model",
        qaModel: getPreferredModels("claude").qaModel,
        qaReasoningEffort: "max",
        savedModelsByBackend: { copilot: getPreferredModels("copilot") },
      }));
    } finally {
      process.argv = originalArgv;
      vi.resetModules();
    }
  });

  it("restores saved model choices when selecting a different backend", async () => {
    const originalArgv = process.argv;
    const saved = { planModel: "custom/plan", devModel: "custom/dev", qaModel: "custom/qa" };
    try {
      process.argv = ["node", "index.ts", "--agent-backend", "opencode"];
      vi.resetModules();
      const { applyCliSettingsOverrides } = await import("./cli-args.js");
      const writeSettings = vi.fn();
      await applyCliSettingsOverrides({
        readSettings: async () => ({ ...DEFAULT_SETTINGS, savedModelsByBackend: { opencode: saved } }),
        writeSettings,
      });
      expect(writeSettings).toHaveBeenCalledWith(expect.objectContaining({ agentBackend: "opencode", ...saved }));
    } finally {
      process.argv = originalArgv;
      vi.resetModules();
    }
  });
});

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
