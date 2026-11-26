import { useMemo, useState } from 'react';

import { AXIS_NAMES, STEP_SETTINGS_DEFAULTS } from '../../constants';
import { useStepCurves } from '../../hooks/useStepCurves';
import type { LogEntry, StepSettings } from '../../types';
import { stepSectionNote } from '../../utils/stepSectionNote';
import { sumStepDiagnostics } from '../../utils/sumStepDiagnostics';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { StepControls } from './StepControls';
import { StepDiagnosticsBar } from './StepDiagnosticsBar';
import { StepResponseAxisPanel } from './StepResponseAxisPanel';

export function StepResponseSection({ entries }: { entries: LogEntry[] }) {
  const [settings, setSettings] = useState<StepSettings>(STEP_SETTINGS_DEFAULTS);
  const [mergeLogs, setMergeLogs] = useState(false);

  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const computed = useStepCurves(entries, settings, effectiveMerge);
  const multi = computed.length > 1;
  const anyDetected = computed.some(({ axes }) => axes.some((d) => d.segments.length > 0));
  const diagSummary = useMemo(() => sumStepDiagnostics(computed), [computed]);

  return (
    <section className="plot-section">
      <h2>Step response</h2>
      <p className="muted">
        {stepSectionNote(settings.splitBy, entries, effectiveMerge, multi)}
        How gyro follows a 1 deg/s step in setpoint, estimated from the whole flight by pooling the setpoint → gyro
        spectra of overlapping windows. The bold line is the estimate; a level below 1 means gyro falls short of
        setpoint. Faint lines are single windows scaled to the same level, to show how much the shape varies.
      </p>

      <StepControls
        settings={settings}
        onChange={setSettings}
        mergeToggle={<MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />}
      />

      <StepDiagnosticsBar diag={diagSummary} />

      {!anyDetected && (
        <p className="muted">
          No usable windows. If <strong>windows</strong> above is 0, the time range is too short for the chosen window
          length — widen the range or shorten the window. Otherwise lower the stick-input or throttle thresholds.
        </p>
      )}

      {settings.splitBy !== 'none' && (
        <div className="step-legend">
          {computed.map((c, b) => (
            <span key={c.id} className="step-legend__item">
              <span className="step-stats__dot" style={{ background: c.color }} />
              {b + 1}: {c.label}
            </span>
          ))}
        </div>
      )}

      {AXIS_NAMES.map((_name, i) => (
        <StepResponseAxisPanel
          key={AXIS_NAMES[i]}
          axisIndex={i}
          perLog={computed.map((c) => ({ id: c.id, label: c.label, color: c.color, dash: c.dash, data: c.axes[i]! }))}
          settings={settings}
        />
      ))}
    </section>
  );
}
