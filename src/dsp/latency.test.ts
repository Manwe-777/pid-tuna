import { describe, expect, test } from 'vitest';

import { computeXcorrLatency } from './latency';
import { mulberry32 } from './mulberry32';
import { stickSetpoint } from './testing/stickSetpoint';

describe('cross-correlation tracking latency', () => {
  const FS = 2000;
  const sp = stickSetpoint({
    seconds: 30,
    sampleRateHz: FS,
    amplitude: 500,
    holdMs: [80, 400],
    smoothingHz: 30,
    seed: 3,
  });

  test('gyro that copies setpoint 5 ms late reads as 5 ms of lag, within a tenth of a sample', () => {
    const gy = new Float32Array(sp.length);
    for (let i = 10; i < sp.length; i++) gy[i] = sp[i - 10]!;
    const r = computeXcorrLatency(sp, gy, FS);
    expect(r.reliable).toBe(true);
    expect(Math.abs(r.lagMs - 5)).toBeLessThan(0.05);
  });

  test('a lag between two samples is resolved to better than a quarter sample', () => {
    const gy = new Float32Array(sp.length);
    for (let i = 11; i < sp.length; i++) gy[i] = 0.5 * (sp[i - 10]! + sp[i - 11]!);
    expect(Math.abs(computeXcorrLatency(sp, gy, FS).lagMs - 5.25)).toBeLessThan(0.125);
  });

  test('pure noise is not reported as a reliable latency', () => {
    const rand = mulberry32(1);
    const noiseA = Float32Array.from({ length: 20000 }, () => (rand() - 0.5) * 200);
    const noiseB = Float32Array.from({ length: 20000 }, () => (rand() - 0.5) * 200);
    expect(computeXcorrLatency(noiseA, noiseB, FS).reliable).toBe(false);
  });
});

describe('tracking latency on real flight time only', () => {
  test('masked ground time with gyro unrelated to setpoint does not move the lag by more than a quarter sample', () => {
    const FS = 2000;
    const sp = stickSetpoint({
      seconds: 30,
      sampleRateHz: FS,
      amplitude: 500,
      holdMs: [80, 400],
      smoothingHz: 30,
      seed: 4,
    });
    const gy = new Float32Array(sp.length);
    for (let i = 12; i < sp.length; i++) gy[i] = sp[i - 12]!;
    const ground = 20000;
    const rand = mulberry32(2);
    for (let i = 0; i < ground; i++) gy[i] = (rand() - 0.5) * 2000;
    const mask = new Uint8Array(sp.length).fill(1);
    mask.fill(0, 0, ground);
    const r = computeXcorrLatency(sp, gy, FS, { mask });
    expect(Math.abs(r.lagMs - 6)).toBeLessThan(0.125);
    expect(r.correlation).toBeGreaterThan(0.9);
  });

  test('a long log is fast enough to compute in a browser', () => {
    const FS = 8000;
    const sp = stickSetpoint({
      seconds: 120,
      sampleRateHz: FS,
      amplitude: 500,
      holdMs: [80, 400],
      smoothingHz: 30,
      seed: 5,
    });
    const t0 = performance.now();
    computeXcorrLatency(sp, sp, FS);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
