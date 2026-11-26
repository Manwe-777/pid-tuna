import type { StepSettings } from '../../types';
import { NumberField } from './NumberField';

type Set = <K extends keyof StepSettings>(key: K, value: StepSettings[K]) => void;

/** Limits that drop single windows whose shape is far from the rest. */
export function StepOutlierFields({ settings, set }: { settings: StepSettings; set: Set }) {
  return (
    <div className="controls">
      <NumberField
        label="Level band"
        value={settings.settleMin}
        min={0}
        max={1}
        step={0.05}
        tip="Drop windows whose own settled level is below this"
        onChange={(v) => set('settleMin', v)}
      />
      <NumberField
        label="to"
        value={settings.settleMax}
        min={1}
        max={3}
        step={0.05}
        tip="Drop windows whose own settled level is above this"
        onChange={(v) => set('settleMax', v)}
      />
      <NumberField
        label="Max distance from median"
        unit="σ"
        value={settings.outlierK}
        min={1}
        max={20}
        step={0.5}
        tip="Drop windows whose settled level is more than this many robust standard deviations from the median"
        onChange={(v) => set('outlierK', v)}
      />
    </div>
  );
}
