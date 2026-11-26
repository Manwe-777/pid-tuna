import { describe, expect, test } from 'vitest';

import { computeXcorrLatency } from './latency';
import { mulberry32 } from './testing/mulberry32';
import { stickSetpoint } from './testing/stickSetpoint';

describe('cross-correlation tracking latency', () => {
  const FS = 2000;
  const sp = stickSetpoint({ seconds: 30, sampleRateHz: FS, amplitude: 500, holdMs: [80, 400], smoothingHz: 30, seed: 3 });

  test('gyro that copies setpoint 5 ms late reads as 5 ms of lag', () => {
    const gy = new Float32Array(sp.length);
    for (let i = 10; i < sp.length; i++) gy[i] = sp[i - 10]!;
    const r = computeXcorrLatency(sp, gy, FS);
    expect(r.reliable).toBe(true);
    expect(r.lagMs).toBeCloseTo(5, 5);
  });

  test.fails('a lag between two samples is resolved to better than a quarter sample', () => {
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
