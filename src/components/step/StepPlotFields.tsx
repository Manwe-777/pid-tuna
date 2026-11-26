import type { StepSettings } from '../../types';

const Y_MAX_CHOICES = [1.25, 1.5, 2];

type Set = <K extends keyof StepSettings>(key: K, value: StepSettings[K]) => void;

/** What the step plots draw. */
export function StepPlotFields({ settings, set }: { settings: StepSettings; set: Set }) {
  return (
    <>
      <label data-tip="Faint lines: every accepted window, scaled to the same level">
        <input
          type="checkbox"
          checked={settings.showSegments}
          onChange={(e) => set('showSegments', e.target.checked)}
        />
        Windows
      </label>
      <label data-tip="Band of ±1 standard deviation of the single-window shapes around the estimate">
        <input type="checkbox" checked={settings.showSpread} onChange={(e) => set('showSpread', e.target.checked)} />
        ±σ band
      </label>
      <label data-tip="Closed-loop tracking and disturbance sensitivity against frequency">
        <input
          type="checkbox"
          checked={settings.showFrequency}
          onChange={(e) => set('showFrequency', e.target.checked)}
        />
        Frequency response
      </label>
      <label data-tip="Top of the step plot's y axis">
        Y max
        <select value={settings.yMax} onChange={(e) => set('yMax', Number.parseFloat(e.target.value))}>
          {Y_MAX_CHOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
