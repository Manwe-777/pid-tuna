import type { FilterSpec } from '../../types';
import { Num } from './Num';

/** Notch count (harmonics for RPM) and Q, shared by the RPM filter and the dynamic notch. */
export function NotchSetFields({
  filter: f,
  onChange,
}: {
  filter: FilterSpec;
  onChange: (patch: Partial<FilterSpec>) => void;
}) {
  return (
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
        tip="Betaflight scale: 500 = Q 5"
        onChange={(v) => onChange({ bfQ: v })}
      />
    </>
  );
}
