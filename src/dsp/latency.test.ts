import { describe, expect, test } from 'vitest';

import type { TuneView } from '../tuneView';
import { computeFilterDelays, computeXcorrLatency } from './latency';
import { mulberry32 } from './testing/mulberry32';
import { stickSetpoint } from './testing/stickSetpoint';

const BASE_VIEW: TuneView = { hasPid: false, pidByAxis: [], hasRates: false, rcRates: [], rcExpo: [], superRates: [] };

/** Betaflight 4.3+ shifts each PT2/PT3 section up so the whole cascade is -3 dB at the set cutoff. */
function betaflightPtnDelayMs(cutoffHz: number, order: number): number {
  const correction = 1 / Math.sqrt(2 ** (1 / order) - 1);

  return (order * 1000) / (2 * Math.PI * correction * cutoffHz);
}

describe('filter delay breakdown', () => {
  test('a PT1 at 100 Hz delays by 1/(2π·100) s', () => {
    const d = computeFilterDelays({ ...BASE_VIEW, gyroLpf1Hz: 100, gyroLpf1Type: 0 });
    expect(d.entries[0]!.groupDelayMs).toBeCloseTo(1.592, 2);
  });

  test.fails("a PT2 delay matches Betaflight's cutoff-corrected PT2", () => {
    const d = computeFilterDelays({ ...BASE_VIEW, gyroLpf1Hz: 100, gyroLpf1Type: 2 });
    expect(d.entries[0]!.groupDelayMs).toBeCloseTo(betaflightPtnDelayMs(100, 2), 2);
  });

  test.fails("a PT3 delay matches Betaflight's cutoff-corrected PT3", () => {
    const d = computeFilterDelays({ ...BASE_VIEW, dtermLpf1Hz: 100, dtermLpf1Type: 3 });
    expect(d.entries[0]!.groupDelayMs).toBeCloseTo(betaflightPtnDelayMs(100, 3), 2);
  });

  test.fails('gyro and D-term filters sit in parallel paths, so the total is not their sum', () => {
    const d = computeFilterDelays({ ...BASE_VIEW, gyroLpf1Hz: 100, gyroLpf1Type: 0, dtermLpf1Hz: 100, dtermLpf1Type: 0 });
    expect(d.totalGroupDelayMs).toBeLessThan(d.entries[0]!.groupDelayMs + d.entries[1]!.groupDelayMs);
  });
});

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
