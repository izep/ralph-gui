import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildColumnFlightKeyframes,
  buildInitialLabColumnFlightOptions,
  clampColumnFlightOptions,
  COLUMN_FLIGHT_VALUE_BOUNDS,
  DEFAULT_COLUMN_FLIGHT_OPTIONS,
  mergeColumnFlightOptions,
  parseColumnFlightParams,
} from "./columnFlight";

function keyframeOffsets(keyframes: Keyframe[]): number[] {
  return keyframes.map((keyframe) => Number(keyframe.offset));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildColumnFlightKeyframes", () => {
  it("returns two stationary keyframes when movement is negligible", () => {
    const keyframes = buildColumnFlightKeyframes(0, 0, DEFAULT_COLUMN_FLIGHT_OPTIONS);
    expect(keyframes).toHaveLength(2);
    expect(keyframeOffsets(keyframes)).toEqual([0, 1]);
  });

  it("keeps keyframe offsets strictly non-decreasing for high arcPortion", () => {
    const highArc = mergeColumnFlightOptions(DEFAULT_COLUMN_FLIGHT_OPTIONS, { arcPortion: 0.95 });
    const keyframes = buildColumnFlightKeyframes(400, 120, highArc);
    const offsets = keyframeOffsets(keyframes);
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeGreaterThanOrEqual(offsets[index - 1]!);
    }
    expect(offsets[offsets.length - 1]).toBe(1);
  });

  it("keeps keyframe offsets strictly non-decreasing for low arcPortion", () => {
    const lowArc = mergeColumnFlightOptions(DEFAULT_COLUMN_FLIGHT_OPTIONS, { arcPortion: 0.2 });
    const keyframes = buildColumnFlightKeyframes(-200, 300, lowArc);
    const offsets = keyframeOffsets(keyframes);
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeGreaterThanOrEqual(offsets[index - 1]!);
    }
  });

  it("ends at the destination translation", () => {
    const dx = 150;
    const dy = -80;
    const keyframes = buildColumnFlightKeyframes(dx, dy, DEFAULT_COLUMN_FLIGHT_OPTIONS);
    const last = keyframes[keyframes.length - 1]!;
    expect(last.transform).toBe(`translate(${dx}px, ${dy}px)`);
  });
});

describe("parseColumnFlightParams", () => {
  it("parses preset and numeric overrides", () => {
    const search =
      "?flightPreset=dramatic&flightDuration=800&flightBulge=1.2&flightWobble=0.5&flightOvershoot=1.1&flightArc=0.7";
    const { partial, preset } = parseColumnFlightParams(search);
    expect(preset).toBe("dramatic");
    expect(partial.durationMs).toBe(800);
    expect(partial.bulgeScale).toBe(1.2);
    expect(partial.wobbleScale).toBe(0.5);
    expect(partial.overshootScale).toBe(1.1);
    expect(partial.arcPortion).toBe(0.7);
  });

  it("ignores invalid preset", () => {
    const { preset } = parseColumnFlightParams("?flightPreset=nope");
    expect(preset).toBeNull();
  });

  it("clamps out-of-range URL values", () => {
    const { partial } = parseColumnFlightParams(
      "?flightDuration=50&flightBulge=99&flightWobble=-1&flightArc=2"
    );
    expect(partial.durationMs).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.durationMs.min);
    expect(partial.bulgeScale).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.bulgeScale.max);
    expect(partial.wobbleScale).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.wobbleScale.min);
    expect(partial.arcPortion).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.arcPortion.max);
  });
});

describe("buildInitialLabColumnFlightOptions", () => {
  it("lets explicit URL values override preset values", () => {
    vi.stubGlobal("window", {
      location: {
        search: "?flightPreset=dramatic&flightDuration=800&flightWobble=0.5",
      },
    });

    const options = buildInitialLabColumnFlightOptions();

    expect(options.durationMs).toBe(800);
    expect(options.wobbleScale).toBe(0.5);
    expect(options.overshootScale).toBe(1.6);
  });
});

describe("clampColumnFlightOptions", () => {
  it("pins values to documented bounds", () => {
    const clamped = clampColumnFlightOptions({
      ...DEFAULT_COLUMN_FLIGHT_OPTIONS,
      durationMs: 50_000,
      arcPortion: 0.01,
      wobbleScale: -5,
    });
    expect(clamped.durationMs).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.durationMs.max);
    expect(clamped.arcPortion).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.arcPortion.min);
    expect(clamped.wobbleScale).toBe(COLUMN_FLIGHT_VALUE_BOUNDS.wobbleScale.min);
  });
});
