import type { StepSettings } from '../../types';
import { NumberField } from './NumberField';

type Set = <K extends keyof StepSettings>(key: K, value: StepSettings[K]) => void;

/** Which windows of the flight the step response is estimated from. */
export function StepWindowFields({ settings, set }: { settings: StepSettings; set: Set }) {
  return (
    <>
      <NumberField
        label="Length"
        unit="ms"
        value={settings.windowMs}
        min={250}
        max={5000}
        step={250}
        tip="Length of each analysis window: long enough to hold the whole step and its settling"
        onChange={(v) => set('windowMs', v)}
      />
      <NumberField
        label="Stick input"
        unit="deg/s"
        value={settings.minExcitation}
        min={0}
        max={500}
        step={5}
        tip="Skip windows whose average |setpoint| is below this: too little stick movement to measure"
        onChange={(v) => set('minExcitation', v)}
      />
      <NumberField
        label="to"
        unit="deg/s"
        value={settings.maxExcitation}
        min={0}
        max={2000}
        step={25}
        placeholder="any"
        tip="Skip windows whose average |setpoint| is above this, to look at gentle moves only (empty = no limit)"
        onChange={(v) => set('maxExcitation', v)}
      />
      <NumberField
        label="Min throttle"
        unit="%"
        value={settings.minThrottle}
        min={0}
        max={80}
        step={5}
        tip="Skip windows with time below this stick throttle: motors at idle respond differently. Time before takeoff and after landing is always skipped."
        onChange={(v) => set('minThrottle', v)}
      />
      <label data-tip="Skip windows where a motor sits at its lowest or highest output: the mixer has no headroom left">
        <input
          type="checkbox"
          checked={settings.excludeSaturation}
          onChange={(e) => set('excludeSaturation', e.target.checked)}
        />
        Skip saturated motors
      </label>
    </>
  );
}
