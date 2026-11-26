import { describe, expect, test } from 'vitest';
import type { StepMetrics, StepResponseResult } from '../../types';
import { stepScoreEntries } from './stepScoreEntries';

function axis(windows: number, metrics: Partial<StepMetrics>): StepResponseResult {
  return {
    segments: Array.from({ length: windows }, () => new Float32Array(1)),
    metrics: { confidence: 0.8, riseTimeMs: 20, overshootPct: 5, sensitivityPeakDb: 3, steadyState: 0.98, ...metrics },
  } as unknown as StepResponseResult;
}

const row = (entries: ReturnType<typeof stepScoreEntries>, key: string) => entries.find((e) => e.key === key)!;

describe('step response scorecard rows', () => {
  test('a well-measured, well-tuned drone is green on every row', () => {
    const e = stepScoreEntries([axis(40, {}), axis(40, {}), axis(40, {})]);
    expect(e.map((r) => r.status)).toEqual(['good', 'good', 'good', 'good']);
  });

  test('a thin pitch estimate is shown with a question mark and does not set the rating', () => {
    const e = stepScoreEntries([axis(40, {}), axis(4, { overshootPct: 45 }), axis(40, {})]);
    expect(row(e, 'Step response (overshoot)').status).toBe('good');
    expect(row(e, 'Step response (overshoot)').value).toContain('Pitch 45.0?');
    expect(row(e, 'Step response (overshoot)').detail).toContain('Pitch');
  });

  test('low coherence also keeps an axis out of the rating', () => {
    const e = stepScoreEntries([axis(40, { confidence: 0.3, riseTimeMs: 80 }), axis(40, {}), axis(40, {})]);
    expect(row(e, 'Step response (rise)').status).toBe('good');
  });

  test('sensitivity peak follows PIDtoolbox’s 4 dB caution and 6 dB severe marks', () => {
    const at = (db: number) =>
      row(stepScoreEntries([axis(40, { sensitivityPeakDb: db }), axis(40, {}), axis(40, {})]), 'Sensitivity peak')
        .status;
    expect([at(3.9), at(4.5), at(6.5)]).toEqual(['good', 'warn', 'bad']);
  });

  test('tracking level is rated on the axis that falls furthest short', () => {
    const e = stepScoreEntries([axis(40, { steadyState: 0.99 }), axis(40, { steadyState: 0.82 }), axis(40, {})]);
    expect(row(e, 'Tracking level').status).toBe('bad');
  });

  test('no rateable axis means no rating rather than a guess', () => {
    const e = stepScoreEntries([axis(3, {}), axis(3, {}), axis(40, {})]);
    expect(e.every((r) => r.status === 'na')).toBe(true);
  });

  test('yaw never affects the rating', () => {
    const e = stepScoreEntries([axis(40, {}), axis(40, {}), axis(40, { overshootPct: 90 })]);
    expect(row(e, 'Step response (overshoot)').status).toBe('good');
  });
});
