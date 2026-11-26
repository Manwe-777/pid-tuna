import type { ReactNode } from 'react';

import { STEP_SETTINGS_DEFAULTS } from '../../constants';
import type { StepSettings } from '../../types';
import { ControlGroup } from '../common/ControlGroup';
import { MetricSelect } from './MetricSelect';
import { StepOutlierFields } from './StepOutlierFields';
import { StepPlotFields } from './StepPlotFields';
import { StepWindowFields } from './StepWindowFields';

interface Props {
  settings: StepSettings;
  onChange: (next: StepSettings) => void;
  mergeToggle: ReactNode;
}

/** Analysis and display settings for the Step response tab. */
export function StepControls({ settings, onChange, mergeToggle }: Props) {
  const set = <K extends keyof StepSettings>(key: K, value: StepSettings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div className="control-panel">
      <ControlGroup title="Analysis windows">
        <StepWindowFields settings={settings} set={set} />
        <button
          type="button"
          className="btn btn--sm"
          disabled={!isAnalysisChanged(settings)}
          data-tip="Back to the settings the scorecard uses"
          onClick={() => onChange({ ...STEP_SETTINGS_DEFAULTS, ...displayOnly(settings) })}
        >
          Defaults
        </button>
      </ControlGroup>

      <ControlGroup title="Compare">
        <label data-tip="Compare how the drone responds to small and large stick moves, or at low and high throttle. Uses the first log.">
          Split by
          <select value={settings.splitBy} onChange={(e) => set('splitBy', e.target.value as StepSettings['splitBy'])}>
            <option value="none">Nothing</option>
            <option value="stick">Stick input</option>
            <option value="throttle">Throttle</option>
          </select>
        </label>
        {mergeToggle}
      </ControlGroup>

      <ControlGroup title="Plot">
        <StepPlotFields settings={settings} set={set} />
      </ControlGroup>

      <ControlGroup title="Dot plots">
        <MetricSelect value={settings.dotMetrics[0]} onChange={(k) => set('dotMetrics', [k, settings.dotMetrics[1]])} />
        <MetricSelect value={settings.dotMetrics[1]} onChange={(k) => set('dotMetrics', [settings.dotMetrics[0], k])} />
      </ControlGroup>

      <details className="control-panel__footer step-controls__advanced">
        <summary>Outlier screening</summary>
        <StepOutlierFields settings={settings} set={set} />
      </details>
    </div>
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
