import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../types';
import { analyzeBattery } from './battery';
import { mulberry32 } from './mulberry32';

const R = 0.025;

/** Slow frames at 10 Hz for 120 s: resting voltage falls linearly from `startV` by 3 V, current bursts between 3 and 90 A. */
function pack(startV: number, headers: Record<string, string> = { vbatcellvoltage: '330,350,430' }) {
  const rand = mulberry32(4);
  const n = 1200;
  const time = Float32Array.from({ length: n }, (_, i) => i / 10);
  const amperage = Float32Array.from({ length: n }, () => (rand() < 0.3 ? 40 + rand() * 50 : 3 + rand() * 10));
  const vbat = Float32Array.from({ length: n }, (_, i) => startV - (3 * i) / n - R * amperage[i]! + (rand() - 0.5) * 0.02);

  return { slow: { time, vbat, amperage }, setup: { rawHeaders: headers } } as unknown as ParsedLog;
}

describe('battery', () => {
  test('internal resistance is recovered from voltage against current', () => {
    expect(analyzeBattery(pack(25.0)).internalResistanceMohm!).toBeCloseTo(R * 1000, 0);
  });

  test('sag under load is resistance × high-load current, not the discharge over the flight', () => {
    const b = analyzeBattery(pack(25.0));
    expect(b.sagUnderLoadV!).toBeGreaterThan(1.4);
    expect(b.sagUnderLoadV!).toBeLessThan(1.8);
    expect(b.sagAtPeakV!).toBeCloseTo(R * b.peakCurrentA!, 1);
  });

  test('a full 6S pack reads 6 cells', () => {
    expect(analyzeBattery(pack(25.2)).cellCount).toBe(6);
  });

  test('a 6S pack starting at storage voltage still reads 6 cells, as Betaflight counts', () => {
    expect(analyzeBattery(pack(22.8)).cellCount).toBe(6);
  });

  test('a LiHV max cell voltage from the header is respected', () => {
    expect(analyzeBattery(pack(17.6, { vbatcellvoltage: '330,350,440' })).cellCount).toBe(4);
  });

  test('a one-sample voltage spike or dropout changes neither the cell count nor the minimum', () => {
    const clean = analyzeBattery(pack(25.0));
    const glitchy = pack(25.0);
    glitchy.slow.vbat[2] = 26.3;
    glitchy.slow.vbat[600] = 16.2;
    const b = analyzeBattery(glitchy);
    expect(b.cellCount).toBe(6);
    expect(b.voltageMin!).toBeCloseTo(clean.voltageMin!, 1);
  });

  test('charge used integrates current over time', () => {
    const b = analyzeBattery(pack(25.0));
    expect(b.mAhUsed!).toBeCloseTo((b.meanCurrentA! * 120) / 3.6, -1);
  });
});
