import {
  COLUMN_FLIGHT_PRESETS,
  DEFAULT_COLUMN_FLIGHT_OPTIONS,
  type ColumnFlightOptions,
} from "../lib/columnFlight";

export function ColumnFlightLabPanel({
  value,
  onChange,
}: {
  value: ColumnFlightOptions;
  onChange: (value: ColumnFlightOptions) => void;
}) {
  const patch = (partial: Partial<ColumnFlightOptions>) => onChange({ ...value, ...partial });

  const applyPreset = (name: keyof typeof COLUMN_FLIGHT_PRESETS) => {
    onChange(
      name === "default"
        ? { ...DEFAULT_COLUMN_FLIGHT_OPTIONS }
        : { ...DEFAULT_COLUMN_FLIGHT_OPTIONS, ...COLUMN_FLIGHT_PRESETS[name] }
    );
  };

  return (
    <details className="column-flight-lab">
      <summary className="column-flight-lab__summary">
        Lane flight demo (animation lab card only)
      </summary>
      <div className="column-flight-lab__body">
        <p className="column-flight-lab__hint">
          Adjust motion for the lane test card. Other tasks keep the default flight. URL
          params: <code className="column-flight-lab__code">flightPreset</code>,{" "}
          <code className="column-flight-lab__code">flightDuration</code>,{" "}
          <code className="column-flight-lab__code">flightBulge</code>,{" "}
          <code className="column-flight-lab__code">flightWobble</code>,{" "}
          <code className="column-flight-lab__code">flightOvershoot</code>,{" "}
          <code className="column-flight-lab__code">flightArc</code>.
        </p>
        <div className="column-flight-lab__presets">
          <button type="button" className="column-flight-lab__btn" onClick={() => applyPreset("default")}>
            Default
          </button>
          <button type="button" className="column-flight-lab__btn" onClick={() => applyPreset("subtle")}>
            Subtle
          </button>
          <button type="button" className="column-flight-lab__btn" onClick={() => applyPreset("dramatic")}>
            Dramatic
          </button>
        </div>
        <label className="column-flight-lab__field">
          <span className="column-flight-lab__label">Duration ({value.durationMs} ms)</span>
          <input
            type="range"
            min={280}
            max={1600}
            step={20}
            value={value.durationMs}
            onChange={(event) => patch({ durationMs: Number(event.target.value) })}
          />
        </label>
        <label className="column-flight-lab__field">
          <span className="column-flight-lab__label">Arc bulge scale ({value.bulgeScale.toFixed(2)})</span>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={value.bulgeScale}
            onChange={(event) => patch({ bulgeScale: Number(event.target.value) })}
          />
        </label>
        <label className="column-flight-lab__field">
          <span className="column-flight-lab__label">
            Overshoot scale ({value.overshootScale.toFixed(2)})
          </span>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={value.overshootScale}
            onChange={(event) => patch({ overshootScale: Number(event.target.value) })}
          />
        </label>
        <label className="column-flight-lab__field">
          <span className="column-flight-lab__label">Wobble scale ({value.wobbleScale.toFixed(2)})</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={value.wobbleScale}
            onChange={(event) => patch({ wobbleScale: Number(event.target.value) })}
          />
        </label>
        <label className="column-flight-lab__field">
          <span className="column-flight-lab__label">Arc timeline share ({value.arcPortion.toFixed(2)})</span>
          <input
            type="range"
            min={0.25}
            max={0.85}
            step={0.01}
            value={value.arcPortion}
            onChange={(event) => patch({ arcPortion: Number(event.target.value) })}
          />
        </label>
      </div>
    </details>
  );
}