import type { ReactNode } from 'react';
import { STEP_METRICS } from '../../constants';
import { STEP_DEFAULTS, type StepMetrics } from '../../dsp/stepResponse';
import { STEP_MASK_DEFAULTS } from '../../dsp/stepResponseForLog';

export interface StepSettings {
  windowMs: number;
  minExcitation: number;
  /** 0 = no ceiling. */
  maxExcitation: number;
  minThrottle: number;
  excludeSaturation: boolean;
  outlierK: number;
  settleMin: number;
  settleMax: number;
  yMax: number;
  showSegments: boolean;
  showSpread: boolean;
  showFrequency: boolean;
  dotMetrics: [keyof StepMetrics, keyof StepMetrics];
  splitBy: 'none' | 'stick' | 'throttle';
}

export const STEP_SETTINGS_DEFAULTS: StepSettings = {
  windowMs: STEP_DEFAULTS.windowMs,
  minExcitation: STEP_DEFAULTS.minExcitation,
  maxExcitation: 0,
  minThrottle: STEP_MASK_DEFAULTS.minThrottle,
  excludeSaturation: STEP_MASK_DEFAULTS.excludeSaturation,
  outlierK: STEP_DEFAULTS.outlierK,
  settleMin: STEP_DEFAULTS.settleMin,
  settleMax: STEP_DEFAULTS.settleMax,
  yMax: 1.5,
  showSegments: true,
  showSpread: false,
  showFrequency: true,
  dotMetrics: ['peakResponse', 'latencyHalfMs'],
  splitBy: 'none',
};

const Y_MAX_CHOICES = [1.25, 1.5, 2];

interface Props {
  settings: StepSettings;
  onChange: (next: StepSettings) => void;
  mergeToggle: ReactNode;
}

/** Analysis and display settings for the Step response tab. */
export function StepControls({ settings, onChange, mergeToggle }: Props) {
  const set = <K extends keyof StepSettings>(key: K, value: StepSettings[K]) => onChange({ ...settings, [key]: value });
  const analysisChanged = isAnalysisChanged(settings);

  return (
    <div className="step-controls">
      <div className="controls step-controls__row">
        <NumberField
          label="Window"
          unit="ms"
          value={settings.windowMs}
          min={250}
          max={5000}
          step={250}
          onChange={(v) => set('windowMs', v)}
        />
        <NumberField
          label="Stick input"
          unit="deg/s"
          value={settings.minExcitation}
          min={0}
          max={500}
          step={5}
          title="Skip windows whose average |setpoint| is below this: too little stick movement to measure"
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
          title="Skip windows whose average |setpoint| is above this, to look at gentle moves only (0 = no limit)"
          onChange={(v) => set('maxExcitation', v)}
        />
        <NumberField
          label="Min throttle"
          unit="%"
          value={settings.minThrottle}
          min={0}
          max={80}
          step={5}
          title="Skip windows with time below this stick throttle: motors at idle respond differently. Time before takeoff and after landing is always skipped."
          onChange={(v) => set('minThrottle', v)}
        />
        <label title="Skip windows where a motor sits at its lowest or highest output: the mixer has no headroom left">
          <input
            type="checkbox"
            checked={settings.excludeSaturation}
            onChange={(e) => set('excludeSaturation', e.target.checked)}
          />
          Skip saturated motors
        </label>
        <button
          type="button"
          className="step-btn-reset"
          disabled={!analysisChanged}
          title="The settings the scorecard uses"
          onClick={() => onChange({ ...STEP_SETTINGS_DEFAULTS, ...displayOnly(settings) })}
        >
          Defaults
        </button>
        <label title="Compare how the drone responds to small and large stick moves, or at low and high throttle. Uses the first log.">
          Split by
          <select value={settings.splitBy} onChange={(e) => set('splitBy', e.target.value as StepSettings['splitBy'])}>
            <option value="none">Nothing</option>
            <option value="stick">Stick input</option>
            <option value="throttle">Throttle</option>
          </select>
        </label>
        {mergeToggle}
      </div>

      <div className="controls step-controls__row">
        <label>
          <input
            type="checkbox"
            checked={settings.showSegments}
            onChange={(e) => set('showSegments', e.target.checked)}
          />
          Windows
        </label>
        <label title="Band of ±1 standard deviation of the single-window shapes around the estimate">
          <input type="checkbox" checked={settings.showSpread} onChange={(e) => set('showSpread', e.target.checked)} />
          ±σ band
        </label>
        <label title="Closed-loop tracking and disturbance sensitivity against frequency">
          <input
            type="checkbox"
            checked={settings.showFrequency}
            onChange={(e) => set('showFrequency', e.target.checked)}
          />
          Frequency response
        </label>
        <label>
          Y max
          <select value={settings.yMax} onChange={(e) => set('yMax', Number.parseFloat(e.target.value))}>
            {Y_MAX_CHOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Compare
          <MetricSelect
            value={settings.dotMetrics[0]}
            onChange={(k) => set('dotMetrics', [k, settings.dotMetrics[1]])}
          />
          <MetricSelect
            value={settings.dotMetrics[1]}
            onChange={(k) => set('dotMetrics', [settings.dotMetrics[0], k])}
          />
        </label>
      </div>

      <details className="step-controls__advanced">
        <summary>Outlier screening</summary>
        <div className="controls step-controls__row">
          <NumberField
            label="Level band"
            value={settings.settleMin}
            min={0}
            max={1}
            step={0.05}
            title="Drop windows whose own settled level is below this"
            onChange={(v) => set('settleMin', v)}
          />
          <NumberField
            label="to"
            value={settings.settleMax}
            min={1}
            max={3}
            step={0.05}
            title="Drop windows whose own settled level is above this"
            onChange={(v) => set('settleMax', v)}
          />
          <NumberField
            label="Max distance from median"
            unit="σ"
            value={settings.outlierK}
            min={1}
            max={20}
            step={0.5}
            title="Drop windows whose settled level is more than this many robust standard deviations from the median"
            onChange={(v) => set('outlierK', v)}
          />
        </div>
      </details>
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step,
  title,
  placeholder,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  title?: string;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label title={title}>
      {label}
      <input
        type="number"
        className="step-controls__number"
        value={placeholder && value === 0 ? '' : value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
        }}
      />
      {unit && <span className="muted">{unit}</span>}
    </label>
  );
}

function MetricSelect({ value, onChange }: { value: keyof StepMetrics; onChange: (k: keyof StepMetrics) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as keyof StepMetrics)}>
      {STEP_METRICS.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

const ANALYSIS_KEYS = [
  'windowMs',
  'minExcitation',
  'maxExcitation',
  'minThrottle',
  'excludeSaturation',
  'outlierK',
  'settleMin',
  'settleMax',
] as const;

function isAnalysisChanged(s: StepSettings): boolean {
  return ANALYSIS_KEYS.some((k) => s[k] !== STEP_SETTINGS_DEFAULTS[k]);
}

function displayOnly(s: StepSettings): Partial<StepSettings> {
  return {
    yMax: s.yMax,
    showSegments: s.showSegments,
    showSpread: s.showSpread,
    showFrequency: s.showFrequency,
    dotMetrics: s.dotMetrics,
    splitBy: s.splitBy,
  };
}
