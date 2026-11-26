import { describe, expect, test } from 'vitest';

import { STEP_METRICS } from '../constants';
import type { StepCurveSet } from '../types';
import { stepMetricsCsv } from './stepMetricsCsv';

const metrics = Object.fromEntries(STEP_METRICS.map((m) => [m.key, null])) as Record<string, number | null>;

const curve = (label: string, rise: number | null) =>
  ({
    label,
    axes: ['Roll', 'Pitch', 'Yaw'].map((name) => ({
      name,
      segments: [new Float32Array(1), new Float32Array(1)],
      metrics: { ...metrics, riseTimeMs: rise, overshootPct: 12.3456 },
    })),
  }) as unknown as StepCurveSet;

describe('stepMetricsCsv', () => {
  test('one row per log and axis, after a header naming each metric with its unit', () => {
    const lines = stepMetricsCsv([curve('A', 10), curve('B', 12)])
      .trim()
      .split('\r\n');

    expect(lines).toHaveLength(1 + 2 * 3);
    expect(lines[0]).toMatch(/^log,axis,windows,Rise \(ms\),/);
    expect(lines[4]!.startsWith('B,Roll,2,12,')).toBe(true);
  });

  test('values keep one digit more than the display', () => {
    const overshoot = STEP_METRICS.find((m) => m.key === 'overshootPct')!;
    const row = stepMetricsCsv([curve('A', 10)])
      .split('\r\n')[1]!
      .split(',');

    expect(row[3 + STEP_METRICS.indexOf(overshoot)]).toBe((12.3456).toFixed(overshoot.digits + 1).replace(/0+$/, ''));
  });

  test('a metric that could not be measured is an empty field', () => {
    const row = stepMetricsCsv([curve('A', null)]).split('\r\n')[1]!;

    expect(row.startsWith('A,Roll,2,,')).toBe(true);
  });
});
