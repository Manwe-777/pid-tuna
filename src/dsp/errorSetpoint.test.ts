import { describe, expect, test } from 'vitest';

import { computeErrorSetpointDensity } from './errorSetpoint';
import { stickSetpoint } from './testing/stickSetpoint';

const FS = 2000;
const LAG = 12;
const sp = stickSetpoint({ seconds: 60, sampleRateHz: FS, amplitude: 600, holdMs: [80, 400], smoothingHz: 10, seed: 3 });

/** Gyro that reaches `gain` of setpoint, LAG samples late. */
const follower = (gain: number) => Float32Array.from(sp, (_, i) => (i >= LAG ? gain * sp[i - LAG]! : 0));

describe('error vs setpoint', () => {
  test('with lag compensation, a drone reaching 90% of setpoint reads a tracking slope of 0.10', () => {
    const r = computeErrorSetpointDensity({ setpoint: sp, gyro: follower(0.9), lagSamples: LAG });
    expect(r.trackingSlope!).toBeCloseTo(0.1, 3);
  });

  test('a perfect but late tracker shows no error once the lag is compensated', () => {
    const late = computeErrorSetpointDensity({ setpoint: sp, gyro: follower(1) });
    const compensated = computeErrorSetpointDensity({ setpoint: sp, gyro: follower(1), lagSamples: LAG });
    expect(late.rmsError!).toBeGreaterThan(5);
    expect(compensated.rmsError!).toBeLessThan(1e-3);
  });

  test('the mean-error line follows the tilt: about +10% of setpoint at the right, −10% at the left', () => {
    const r = computeErrorSetpointDensity({ setpoint: sp, gyro: follower(0.9), lagSamples: LAG });
    const pick = (x: number) => {
      let best = 0;
      r.xCenters.forEach((c, i) => {
        if (Math.abs(c - x) < Math.abs(r.xCenters[best]! - x) && Number.isFinite(r.meanError[i]!)) best = i;
      });
      return { x: r.xCenters[best]!, e: r.meanError[best]! };
    };
    const hi = pick(r.setpointRange * 0.7);
    const lo = pick(-r.setpointRange * 0.7);
    expect(hi.e / hi.x).toBeCloseTo(0.1, 2);
    expect(lo.e / lo.x).toBeCloseTo(0.1, 2);
  });

  test('masked-out samples (ground time) are left out', () => {
    const gyro = follower(1);
    const mask = new Uint8Array(sp.length).fill(1);
    mask.fill(0, 0, sp.length / 2);
    const all = computeErrorSetpointDensity({ setpoint: sp, gyro });
    const half = computeErrorSetpointDensity({ setpoint: sp, gyro, mask });
    expect(half.sampleCount).toBeLessThan(all.sampleCount * 0.6);
  });

  test('several axes pool into one density, each with its own lag', () => {
    const r = computeErrorSetpointDensity([
      { setpoint: sp, gyro: follower(0.9), lagSamples: LAG },
      { setpoint: sp, gyro: follower(0.9), lagSamples: LAG },
    ]);
    expect(r.trackingSlope!).toBeCloseTo(0.1, 3);
  });

  test('a value exactly at the edge of the forced range is counted, not dropped', () => {
    const r = computeErrorSetpointDensity(
      { setpoint: Float32Array.of(100, -100, 0), gyro: Float32Array.of(100, -100, 0) },
      { setpointRange: 100, errorRange: 1, xBins: 4, yBins: 4 },
    );
    expect(r.sampleCount).toBe(3);
  });
});
