import { STEP_METRICS } from '../constants';
import type { StepCurveSet } from '../types';
import { toCsv } from './toCsv';

/** Step-response metrics, one row per curve (log, pool or band) and axis, rounded one digit past the display. */
export function stepMetricsCsv(curves: StepCurveSet[]): string {
  const header = ['log', 'axis', 'windows', ...STEP_METRICS.map((m) => (m.unit ? `${m.label} (${m.unit})` : m.label))];
  const rows = curves.flatMap((c) =>
    c.axes.map((a) => [
      c.label,
      a.name,
      a.segments.length,
      ...STEP_METRICS.map((m) => {
        const v = a.metrics[m.key];

        return v == null ? null : Number(v.toFixed(m.digits + 1));
      }),
    ]),
  );

  return toCsv(header, rows);
}
