import { describe, expect, test } from 'vitest';

import { stepResponseBands } from './stepResponseBands';
import { simulateClosedLoop } from './testing/simulateClosedLoop';
import { stickSetpoint } from './testing/stickSetpoint';
import { syntheticLog } from './testing/syntheticLog';
import { trueStepMetrics } from './testing/trueStepMetrics';

const FS = 2000;
const SLOW = { naturalHz: 10, damping: 0.6, delaySamples: 8 };
const FAST = { naturalHz: 18, damping: 0.6, delaySamples: 8 };

describe('step response by throttle band', () => {
  test('a drone that is sluggish at low throttle and snappy at high throttle shows it band by band', () => {
    const sp = stickSetpoint({ seconds: 120, sampleRateHz: FS, amplitude: 500, holdMs: [100, 500], smoothingHz: 10, seed: 3 });
    const half = sp.length / 2;
    const gyro = new Float32Array(sp.length);
    gyro.set(simulateClosedLoop(sp.subarray(0, half), FS, SLOW), 0);
    gyro.set(simulateClosedLoop(sp.subarray(half), FS, FAST), half);
    const throttle = new Float32Array(sp.length).fill(25);
    throttle.fill(65, half);

    const bands = stepResponseBands(syntheticLog(sp, gyro, throttle, FS), 0, 'throttle');
    const low = bands.find((b) => b.from === 15)!.result.metrics.riseTimeMs!;
    const high = bands.find((b) => b.from === 55)!.result.metrics.riseTimeMs!;
    expect(Math.abs(low - trueStepMetrics(SLOW, FS).riseTimeMs)).toBeLessThan(3);
    expect(Math.abs(high - trueStepMetrics(FAST, FS).riseTimeMs)).toBeLessThan(3);
    expect(bands.find((b) => b.from === 35)!.result.segments).toHaveLength(0);
  });
});

describe('step response by stick input band', () => {
  test('a drone that saturates on big moves falls short only in the large-input band', () => {
    const sp = stickSetpoint({ seconds: 120, sampleRateHz: FS, amplitude: 700, holdMs: [100, 500], smoothingHz: 10, seed: 4 });
    const limited = sp.map((v) => Math.max(-300, Math.min(300, v)));
    const gyro = simulateClosedLoop(limited, FS, FAST);
    const throttle = new Float32Array(sp.length).fill(40);

    const bands = stepResponseBands(syntheticLog(sp, gyro, throttle, FS), 0, 'stick');
    const small = bands[0]!.result.metrics.steadyState!;
    const large = bands[bands.length - 1]!.result.metrics.steadyState!;
    expect(small).toBeGreaterThan(0.95);
    expect(large).toBeLessThan(small - 0.1);
  });

  test('bands are labelled with their range and an open top band', () => {
    const sp = stickSetpoint({ seconds: 10, sampleRateHz: FS, amplitude: 300, holdMs: [100, 500], smoothingHz: 10, seed: 5 });
    const labels = stepResponseBands(syntheticLog(sp, sp, new Float32Array(sp.length).fill(40), FS), 0, 'stick').map((b) => b.label);
    expect(labels).toEqual(['20–100 deg/s', '100–250 deg/s', '250+ deg/s']);
  });
});
