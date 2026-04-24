export type ColumnFlightOptions = {
  durationMs: number;
  bulgeScale: number;
  bulgeMaxPx: number;
  overshootScale: number;
  overshootMaxPx: number;
  wobbleScale: number;
  arcPortion: number;
};

export const DEFAULT_COLUMN_FLIGHT_OPTIONS: ColumnFlightOptions = {
  durationMs: 680,
  bulgeScale: 1,
  bulgeMaxPx: 36,
  overshootScale: 1,
  overshootMaxPx: 14,
  wobbleScale: 1,
  arcPortion: 0.6,
};

/** Matches lab UI / sane URL overrides; full options are clamped after merge. */
export const COLUMN_FLIGHT_VALUE_BOUNDS: Record<
  keyof ColumnFlightOptions,
  { min: number; max: number }
> = {
  durationMs: { min: 280, max: 1600 },
  bulgeScale: { min: 0, max: 2.5 },
  bulgeMaxPx: { min: 0, max: 80 },
  overshootScale: { min: 0, max: 2.5 },
  overshootMaxPx: { min: 0, max: 40 },
  wobbleScale: { min: 0, max: 3 },
  arcPortion: { min: 0.2, max: 0.95 },
};

function clampToBounds(key: keyof ColumnFlightOptions, value: number): number {
  const { min, max } = COLUMN_FLIGHT_VALUE_BOUNDS[key];
  return Math.min(max, Math.max(min, value));
}

export function clampColumnFlightOptions(options: ColumnFlightOptions): ColumnFlightOptions {
  return {
    durationMs: clampToBounds("durationMs", options.durationMs),
    bulgeScale: clampToBounds("bulgeScale", options.bulgeScale),
    bulgeMaxPx: clampToBounds("bulgeMaxPx", options.bulgeMaxPx),
    overshootScale: clampToBounds("overshootScale", options.overshootScale),
    overshootMaxPx: clampToBounds("overshootMaxPx", options.overshootMaxPx),
    wobbleScale: clampToBounds("wobbleScale", options.wobbleScale),
    arcPortion: clampToBounds("arcPortion", options.arcPortion),
  };
}

function clampPartialColumnFlightOptions(
  partial: Partial<ColumnFlightOptions>
): Partial<ColumnFlightOptions> {
  const out: Partial<ColumnFlightOptions> = {};
  for (const key of Object.keys(partial) as (keyof ColumnFlightOptions)[]) {
    const value = partial[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = clampToBounds(key, value);
    }
  }
  return out;
}

export const COLUMN_FLIGHT_PRESETS: Record<
  "default" | "subtle" | "dramatic",
  Partial<ColumnFlightOptions>
> = {
  default: {},
  subtle: {
    durationMs: 520,
    bulgeScale: 0.55,
    overshootScale: 0.5,
    wobbleScale: 0.35,
    arcPortion: 0.55,
  },
  dramatic: {
    durationMs: 920,
    bulgeScale: 1.45,
    overshootScale: 1.6,
    wobbleScale: 2.2,
    arcPortion: 0.65,
  },
};

export function mergeColumnFlightOptions(
  base: ColumnFlightOptions,
  partial: Partial<ColumnFlightOptions> | null | undefined
): ColumnFlightOptions {
  return { ...base, ...partial };
}

export function columnFlightTransform(translateX: number, translateY: number): string {
  return `translate(${translateX}px, ${translateY}px)`;
}

function easeOutCubic(t: number): number {
  const inverse = 1 - t;
  return 1 - inverse * inverse * inverse;
}

function quad2(
  t: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number
): { x: number; y: number } {
  const inverse = 1 - t;
  return {
    x: 2 * inverse * t * controlX + t * t * endX,
    y: 2 * inverse * t * controlY + t * t * endY,
  };
}

export function buildColumnFlightKeyframes(
  dx: number,
  dy: number,
  opts: ColumnFlightOptions = DEFAULT_COLUMN_FLIGHT_OPTIONS
): Keyframe[] {
  const length = Math.hypot(dx, dy);
  if (length < 0.5) {
    return [
      { offset: 0, transform: columnFlightTransform(0, 0) },
      { offset: 1, transform: columnFlightTransform(0, 0) },
    ];
  }

  const perpendicularX = dy / length;
  const perpendicularY = -dx / length;
  const bulge = Math.min(opts.bulgeMaxPx, opts.bulgeScale * 0.14 * length);
  const controlX = dx * 0.5 - perpendicularX * bulge;
  const controlY = dy * 0.5 - perpendicularY * bulge;

  const tangentX = 2 * (dx - controlX);
  const tangentY = 2 * (dy - controlY);
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const tangentUnitX = tangentX / tangentLength;
  const tangentUnitY = tangentY / tangentLength;
  const overshoot = Math.min(opts.overshootMaxPx, opts.overshootScale * length * 0.07);
  const wobble = opts.wobbleScale;
  const wobble1 = 3.6 * wobble;
  const wobble2 = -2.8 * wobble;
  const wobble3 = 0.9 * wobble;

  const pathEnd = Math.min(0.95, Math.max(0.2, opts.arcPortion));
  const segments = 11;
  const keyframes: Keyframe[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = quad2(easeOutCubic(t), controlX, controlY, dx, dy);
    keyframes.push({
      offset: t * pathEnd,
      transform: columnFlightTransform(point.x, point.y),
      easing: "linear",
    });
  }

  const tailSpan = 1 - pathEnd;
  const tail = (fraction: number) => pathEnd + tailSpan * fraction;

  keyframes.push({
    offset: tail(0.25),
    transform: columnFlightTransform(
      dx + tangentUnitX * overshoot,
      dy + tangentUnitY * overshoot
    ),
    easing: "cubic-bezier(0.34, 0.9, 0.35, 1.12)",
  });
  keyframes.push({
    offset: tail(0.45),
    transform: columnFlightTransform(dx, dy),
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  });
  keyframes.push({
    offset: tail(0.575),
    transform: columnFlightTransform(dx + wobble1, dy),
    easing: "cubic-bezier(0.45, 0, 0.55, 1)",
  });
  keyframes.push({
    offset: tail(0.7),
    transform: columnFlightTransform(dx + wobble2, dy),
    easing: "cubic-bezier(0.45, 0, 0.55, 1)",
  });
  keyframes.push({
    offset: tail(0.8),
    transform: columnFlightTransform(dx + wobble3, dy),
    easing: "cubic-bezier(0.45, 0, 0.55, 1)",
  });
  keyframes.push({ offset: 1, transform: columnFlightTransform(dx, dy) });

  return keyframes;
}

const STORAGE_KEY = "ralph.columnFlight.lab";

function sanitizeColumnFlightPartial(raw: unknown): Partial<ColumnFlightOptions> {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const out: Partial<ColumnFlightOptions> = {};
  const numberValue = (key: keyof ColumnFlightOptions) => {
    const value = record[key as string];
    if (typeof value === "number" && Number.isFinite(value)) {
      (out as Record<string, number>)[key as string] = value;
    }
  };

  numberValue("durationMs");
  numberValue("bulgeScale");
  numberValue("bulgeMaxPx");
  numberValue("overshootScale");
  numberValue("overshootMaxPx");
  numberValue("wobbleScale");
  numberValue("arcPortion");
  return clampPartialColumnFlightOptions(out);
}

export function readColumnFlightLabFromStorage(): Partial<ColumnFlightOptions> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = sanitizeColumnFlightPartial(JSON.parse(raw) as unknown);
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeColumnFlightLabToStorage(options: ColumnFlightOptions): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Ignore quota errors.
  }
}

export function buildInitialLabColumnFlightOptions(): ColumnFlightOptions {
  let options: ColumnFlightOptions = { ...DEFAULT_COLUMN_FLIGHT_OPTIONS };
  const stored = readColumnFlightLabFromStorage();
  if (stored) options = mergeColumnFlightOptions(options, stored);
  if (typeof window !== "undefined") {
    const { partial, preset } = parseColumnFlightParams(window.location.search);
    if (preset) options = mergeColumnFlightOptions(options, COLUMN_FLIGHT_PRESETS[preset]);
    options = mergeColumnFlightOptions(options, partial);
  }
  return clampColumnFlightOptions(options);
}

export function parseColumnFlightParams(search: string): {
  partial: Partial<ColumnFlightOptions>;
  preset: keyof typeof COLUMN_FLIGHT_PRESETS | null;
} {
  const params = new URLSearchParams(search);
  const presetRaw = params.get("flightPreset");
  const preset =
    presetRaw === "subtle" || presetRaw === "dramatic" || presetRaw === "default"
      ? presetRaw
      : null;
  const partial: Partial<ColumnFlightOptions> = {};

  const numberValue = (key: string): number | undefined => {
    const value = params.get(key);
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const duration = numberValue("flightDuration");
  if (duration !== undefined) partial.durationMs = duration;
  const bulge = numberValue("flightBulge");
  if (bulge !== undefined) partial.bulgeScale = bulge;
  const wobble = numberValue("flightWobble");
  if (wobble !== undefined) partial.wobbleScale = wobble;
  const overshoot = numberValue("flightOvershoot");
  if (overshoot !== undefined) partial.overshootScale = overshoot;
  const arc = numberValue("flightArc");
  if (arc !== undefined) partial.arcPortion = arc;

  return { partial: clampPartialColumnFlightOptions(partial), preset };
}