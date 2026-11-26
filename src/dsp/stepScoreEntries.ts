import { AXIS_NAMES } from '../axes';
import type { ScoreEntry, ScoreStatus } from './scorecard';
import type { StepMetrics, StepResponseResult } from './stepResponse';

/** Roll and pitch only: yaw on a typical fixed-camera log is too quiet to rate fairly. */
const RATED_AXES = [0, 1] as const;
/** An axis is only rated with at least this many windows… */
const MIN_WINDOWS = 10;
/** …and at least this much coherence between setpoint and gyro. */
const MIN_CONFIDENCE = 0.5;

interface Row {
  key: string;
  metric: keyof StepMetrics;
  unit: string;
  digits: number;
  worst: 'max' | 'min';
  status: (worst: number) => ScoreStatus;
}

const ROWS: Row[] = [
  { key: 'Step response (rise)', metric: 'riseTimeMs', unit: ' ms', digits: 1, worst: 'max', status: (v) => (v < 30 ? 'good' : v < 50 ? 'warn' : 'bad') },
  { key: 'Step response (overshoot)', metric: 'overshootPct', unit: '%', digits: 1, worst: 'max', status: (v) => (v < 10 ? 'good' : v < 20 ? 'warn' : 'bad') },
  { key: 'Sensitivity peak', metric: 'sensitivityPeakDb', unit: ' dB', digits: 1, worst: 'max', status: (v) => (v < 4 ? 'good' : v < 6 ? 'warn' : 'bad') },
  { key: 'Tracking level', metric: 'steadyState', unit: '', digits: 2, worst: 'min', status: (v) => (v >= 0.95 ? 'good' : v >= 0.85 ? 'warn' : 'bad') },
];

/**
 * Scorecard rows for the step response. Axes without enough usable windows or
 * coherence are shown but not rated, so a thin pitch estimate can't turn the
 * card red (or green) on its own.
 */
export function stepScoreEntries(steps: StepResponseResult[]): ScoreEntry[] {
  if (!steps.some((s) => s.segments.length > 0)) return [];

  const trusted = RATED_AXES.filter((i) => isTrusted(steps[i]));
  const untrusted = RATED_AXES.filter((i) => !trusted.includes(i) && (steps[i]?.segments.length ?? 0) > 0);
  const note = untrusted.length
    ? `${untrusted.map((i) => AXIS_NAMES[i]).join(' and ')}: too few usable windows to rate`
    : `${RATED_AXES.reduce<number>((a, i) => a + (steps[i]?.segments.length ?? 0), 0)} step windows analyzed`;

  return ROWS.map((row) => {
    const values = trusted.map((i) => steps[i]!.metrics[row.metric]).filter((v): v is number => v != null);
    const worst = values.length ? (row.worst === 'max' ? Math.max(...values) : Math.min(...values)) : null;
    const value =
      RATED_AXES.map((i) => {
        const v = steps[i]?.metrics[row.metric];
        const text = v != null ? v.toFixed(row.digits) : '—';
        return `${AXIS_NAMES[i]} ${text}${trusted.includes(i) || v == null ? '' : '?'}`;
      }).join(' · ') + row.unit;

    return { key: row.key, status: worst == null ? 'na' : row.status(worst), value, detail: note };
  });
}

function isTrusted(step: StepResponseResult | undefined): boolean {
  if (!step || step.segments.length < MIN_WINDOWS) return false;

  return (step.metrics.confidence ?? 0) >= MIN_CONFIDENCE;
}
