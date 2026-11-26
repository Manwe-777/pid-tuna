import type { FilterSpec, FilterType } from '../../types';
import { filterFrequencyLabel } from '../../utils/filterFrequencyLabel';
import { NotchSetFields } from './NotchSetFields';
import { Num } from './Num';
import { RpmFields } from './RpmFields';

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
        label={filterFrequencyLabel(f.type)}
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
      {(f.type === 'rpm' || f.type === 'dynNotch') && <NotchSetFields filter={f} onChange={onChange} />}
      {f.type === 'rpm' && <RpmFields filter={f} maxHz={maxHz} onChange={onChange} />}
      <button type="button" className="filter-row__remove" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}
