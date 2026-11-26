import { useMemo, useState } from 'react';
import { AXIS_COLORS, AXIS_NAMES, BAND_COLORS } from '../../constants';
import { combineStepResponses } from '../../dsp/combineStepResponses';
import { type StepBandKind, stepResponseBands } from '../../dsp/stepResponseBands';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogEntry, StepCurveSet } from '../../types';
import { computeAxisSteps } from '../../utils/computeAxisSteps';
import { makeMergedSlot } from '../../utils/makeMergedSlot';
import { stepOptionsFrom } from '../../utils/stepOptionsFrom';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { STEP_SETTINGS_DEFAULTS, StepControls, type StepSettings } from './StepControls';
import { StepResponseAxisPanel } from './StepResponseAxisPanel';

export function StepResponseSection({ entries }: { entries: LogEntry[] }) {
  const [settings, setSettings] = useState<StepSettings>(STEP_SETTINGS_DEFAULTS);
  const [mergeLogs, setMergeLogs] = useState(false);

  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const analysisOptions = useMemo(
    () => stepOptionsFrom(settings),
    // Only the analysis fields: display toggles must not trigger a recompute.
    [
      settings.windowMs,
      settings.minExcitation,
      settings.maxExcitation,
      settings.minThrottle,
      settings.excludeSaturation,
      settings.outlierK,
      settings.settleMin,
      settings.settleMax,
    ],
  );

  const computed = useMemo<StepCurveSet[]>(() => {
    if (settings.splitBy !== 'none' && entries[0]) {
      const { log } = entries[0];
      const perAxis = AXIS_NAMES.map((_n, i) =>
        stepResponseBands(log, i, settings.splitBy as StepBandKind, analysisOptions),
      );
      return perAxis[0]!.map((band, b) => ({
        id: `band-${b}`,
        label: band.label,
        color: BAND_COLORS[b % BAND_COLORS.length]!,
        dash: [],
        axes: AXIS_NAMES.map((name, i) => ({ name, color: AXIS_COLORS[i]!, ...perAxis[i]![b]!.result })),
      }));
    }

    const perLog = entries.map(({ slot, log, dash }) => ({
      id: slot.id,
      label: shortName(slot),
      color: colorFor(slot),
      dash,
      axes: computeAxisSteps(log, analysisOptions),
    }));
    if (!effectiveMerge) return perLog;
    const merged = makeMergedSlot(entries);
    const mergedAxes = AXIS_NAMES.map((name, i) => ({
      name,
      color: AXIS_COLORS[i]!,
      ...combineStepResponses(perLog.map((p) => p.axes[i]!)),
    }));
    return [{ id: merged.id, label: shortName(merged), color: colorFor(merged), dash: [], axes: mergedAxes }];
  }, [entries, analysisOptions, effectiveMerge, settings.splitBy]);
  const multi = computed.length > 1;

  const anyDetected = computed.some(({ axes }) => axes.some((d) => d.segments.length > 0));

  const diagSummary = useMemo(() => {
    const sum = {
      windowsTotal: 0,
      windowsLowExcitation: 0,
      windowsHighExcitation: 0,
      windowsMasked: 0,
      windowsBadSettle: 0,
      windowsAccepted: 0,
      peakSetpoint: 0,
    };
    for (const c of computed) {
      for (const a of c.axes) {
        const d = a.diagnostics;
        sum.windowsTotal += d.windowsTotal;
        sum.windowsLowExcitation += d.windowsLowExcitation;
        sum.windowsHighExcitation += d.windowsHighExcitation;
        sum.windowsMasked += d.windowsMasked;
        sum.windowsBadSettle += d.windowsBadSettle;
        sum.windowsAccepted += d.windowsAccepted;
        sum.peakSetpoint = Math.max(sum.peakSetpoint, d.peakSetpoint);
      }
    }
    return sum;
  }, [computed]);

  return (
    <section className="plot-section">
      <h2>Step response</h2>
      <p className="muted">
        {settings.splitBy !== 'none' &&
          entries[0] &&
          `Bands from ${shortName(entries[0].slot)}, by ${settings.splitBy === 'stick' ? 'average stick input per window' : 'stick throttle'}. `}
        {settings.splitBy === 'none' &&
          effectiveMerge &&
          `Pooling windows from ${entries.length} logs into one estimate. `}
        {multi && settings.splitBy === 'none' && 'Each log uses its own dash pattern. '}
        How gyro follows a 1 deg/s step in setpoint, estimated from the whole flight by pooling the setpoint → gyro
        spectra of overlapping windows. The bold line is the estimate; a level below 1 means gyro falls short of
        setpoint. Faint lines are single windows scaled to the same level, to show how much the shape varies.
      </p>

      <StepControls
        settings={settings}
        onChange={setSettings}
        mergeToggle={<MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />}
      />

      <div className="step-diag">
        <span className="step-diag__item">
          <span className="step-diag__k">accepted</span>
          <span className="step-diag__v">{diagSummary.windowsAccepted}</span>
        </span>
        <span className="step-diag__sep">←</span>
        <span className="step-diag__item">
          <span className="step-diag__k">windows</span>
          <span className="step-diag__v">{diagSummary.windowsTotal}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">too little stick</span>
          <span className="step-diag__v">{diagSummary.windowsLowExcitation}</span>
        </span>
        {diagSummary.windowsHighExcitation > 0 && (
          <span className="step-diag__item">
            <span className="step-diag__k">too much stick</span>
            <span className="step-diag__v">{diagSummary.windowsHighExcitation}</span>
          </span>
        )}
        <span className="step-diag__item">
          <span className="step-diag__k">low throttle / saturated</span>
          <span className="step-diag__v">{diagSummary.windowsMasked}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">outliers</span>
          <span className="step-diag__v">{diagSummary.windowsBadSettle}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">peak setpoint</span>
          <span className="step-diag__v">{diagSummary.peakSetpoint.toFixed(0)}</span>
        </span>
      </div>

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
