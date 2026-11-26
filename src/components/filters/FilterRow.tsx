import type { FilterSpec, FilterType } from '../../dsp/filters';

const LABEL: Record<FilterType, string> = {
  pt1: 'PT1 LPF',
  pt2: 'PT2 LPF',
  pt3: 'PT3 LPF',
  biquad: 'Biquad LPF',
  notch: 'Notch',
  rpm: 'RPM filter',
  dynNotch: 'Dynamic notch',
};

interface Props {
  filter: FilterSpec;
  /** Highest frequency a filter can be set to, Hz. */
  maxHz: number;
  onChange: (patch: Partial<FilterSpec>) => void;
  onRemove: () => void;
}

/** One editable block in the simulator chain. */
export function FilterRow({ filter, maxHz, onChange, onRemove }: Props) {
  const f = filter;

  return (
    <div className="filter-row">
      <input
        type="checkbox"
        checked={f.enabled}
        onChange={(e) => onChange({ enabled: e.target.checked })}
        title="Enable / disable"
      />
      <span className="filter-row__type">{LABEL[f.type]}</span>
      <Num
        label={f.type === 'rpm' ? 'Motor' : f.type === 'notch' || f.type === 'dynNotch' ? 'Centre' : 'Cutoff'}
        unit="Hz"
        value={f.cutoffHz}
        min={1}
        max={maxHz - 1}
        step={5}
        title={f.type === 'rpm' ? 'Motor rotation frequency: the 1st harmonic' : undefined}
        onChange={(v) => onChange({ cutoffHz: v })}
      />
      {f.type === 'notch' && (
        <Num
          label="BW"
          unit="Hz"
          value={f.bandwidth}
          min={1}
          max={maxHz}
          step={5}
          onChange={(v) => onChange({ bandwidth: v })}
        />
      )}
      {(f.type === 'rpm' || f.type === 'dynNotch') && (
        <>
          <Num
            label={f.type === 'rpm' ? 'Harmonics' : 'Count'}
            value={f.count ?? 1}
            min={1}
            max={f.type === 'rpm' ? 3 : 5}
            step={1}
            onChange={(v) => onChange({ count: Math.round(v) })}
          />
          <Num
            label="Q"
            value={f.bfQ ?? 500}
            min={10}
            max={2000}
            step={10}
            title="Betaflight scale: 500 = Q 5"
            onChange={(v) => onChange({ bfQ: v })}
          />
        </>
      )}
      {f.type === 'rpm' && (
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
      )}
      <button type="button" className="filter-row__remove" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}

function Num({
  label,
  unit,
  value,
  min,
  max,
  step,
  title,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  title?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label title={title}>
      {label}:
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={{ width: '4.5rem' }}
      />
      {unit && <span className="filter-row__unit">{unit}</span>}
    </label>
  );
}
