import type { FilterSpec } from '../../types';
import { Num } from './Num';

/** RPM-filter settings: minimum frequency, fade, per-harmonic weights and motor count. */
export function RpmFields({
  filter: f,
  maxHz,
  onChange,
}: {
  filter: FilterSpec;
  maxHz: number;
  onChange: (patch: Partial<FilterSpec>) => void;
}) {
  return (
    <>
      <Num
        label="Min"
        unit="Hz"
        value={f.minHz ?? 100}
        min={0}
        max={maxHz}
        step={5}
        onChange={(v) => onChange({ minHz: v })}
      />
      <Num
        label="Fade"
        unit="Hz"
        value={f.fadeHz ?? 50}
        min={0}
        max={500}
        step={5}
        title="Notches fade in from 0% at the minimum to full weight at minimum + fade"
        onChange={(v) => onChange({ fadeHz: v })}
      />
      <label title="Per-harmonic weights, %">
        Weights
        <input
          type="text"
          value={(f.weights ?? []).join(',')}
          onChange={(e) =>
            onChange({
              weights: e.target.value
                .split(',')
                .map((x) => Number.parseFloat(x))
                .filter(Number.isFinite),
            })
          }
          style={{ width: '6.5rem' }}
        />
      </label>
      <Num
        label="Motors"
        value={f.motors ?? 4}
        min={1}
        max={8}
        step={1}
        onChange={(v) => onChange({ motors: Math.round(v) })}
      />
    </>
  );
}
