import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../types';
import { analyzeMotorBalance } from './motorBalance';

const FS = 100;

/** 10 s log, flying from 2 s to 8 s. Each motor sits at its given output (0–1 of the range) in flight and at idle on the ground. */
function fakeLog(
  levels: number[],
  opts: { motorOutput?: [number, number]; headers?: Record<string, string> } = {},
): ParsedLog {
  const [lo, hi] = opts.motorOutput ?? [48, 2047];
  const n = 10 * FS;
  const flying = (i: number) => i >= 2 * FS && i < 8 * FS;
  const zeros = new Float32Array(n);

  return {
    time: Float32Array.from({ length: n }, (_, i) => i / FS),
    motor: levels.map((l) => Float32Array.from({ length: n }, (_, i) => lo + (hi - lo) * (flying(i) ? l : 0.05))),
    eRpm: [],
    rcCommand: [zeros, zeros, zeros, Float32Array.from({ length: n }, (_, i) => (flying(i) ? 1400 : 1000))],
    setup: { sampleRateHz: FS, rawHeaders: { motorOutput: `${lo},${hi}`, ...opts.headers } },
  } as unknown as ParsedLog;
}

const axis = (a: ReturnType<typeof analyzeMotorBalance>, k: string) => a.axes.find((x) => x.axis === k)!.deltaPct;

describe('motor balance', () => {
  test('rear motors 0.04 above the front ones read as that gap over the mean output, +9.5% on pitch', () => {
    const a = analyzeMotorBalance(fakeLog([0.44, 0.4, 0.44, 0.4]));
    expect(axis(a, 'pitch')).toBeCloseTo((0.04 / 0.42) * 100, 1);
    expect(a.dominantAxis).toBe('pitch');
  });

  test('the same imbalance reads the same on DShot and on PWM', () => {
    const dshot = axis(analyzeMotorBalance(fakeLog([0.44, 0.4, 0.44, 0.4])), 'pitch');
    const pwm = axis(analyzeMotorBalance(fakeLog([0.44, 0.4, 0.44, 0.4], { motorOutput: [1000, 2000] })), 'pitch');
    expect(pwm).toBeCloseTo(dshot, 3);
  });

  test('idle time on the ground does not dilute the imbalance', () => {
    const a = analyzeMotorBalance(fakeLog([0.5, 0.4, 0.4, 0.4]));
    expect(a.singleMotorOutlier!.motorIndex).toBe(0);
    expect(a.singleMotorOutlier!.deltaPct).toBeCloseTo((0.1 / 0.425) * 100, 0);
  });

  test('reversed props flip the yaw sign', () => {
    const levels = [0.4, 0.44, 0.44, 0.4];
    const normal = axis(analyzeMotorBalance(fakeLog(levels)), 'yaw');
    const reversed = axis(analyzeMotorBalance(fakeLog(levels, { headers: { yaw_motors_reversed: '1' } })), 'yaw');
    expect(normal).toBeGreaterThan(0);
    expect(reversed).toBeCloseTo(-normal, 6);
  });

  test('balanced motors have no dominant axis and no outlier', () => {
    const a = analyzeMotorBalance(fakeLog([0.4, 0.4, 0.4, 0.4]));
    expect(a.dominantAxis).toBeNull();
    expect(a.singleMotorOutlier).toBeNull();
  });
});
