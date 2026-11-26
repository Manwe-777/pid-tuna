import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../types';
import { stepResponseMask } from './stepResponseMask';

function fakeLog(throttle: number[], motors: number[][], motorOutput = '48,2047'): ParsedLog {
  const n = throttle.length;
  const zeros = new Float32Array(n);

  return {
    time: new Float32Array(n),
    setpoint: [zeros, zeros, zeros, Float32Array.from(throttle)],
    motor: motors.map((m) => Float32Array.from(m)),
    setup: { rawHeaders: { motorOutput } },
  } as unknown as ParsedLog;
}

describe('step response sample mask', () => {
  test('samples below the throttle floor are unusable, the rest usable', () => {
    const log = fakeLog([0, 10, 30, 50], [[1000, 1000, 1000, 1000]]);
    expect(Array.from(stepResponseMask(log, { minThrottle: 25 }))).toEqual([0, 0, 1, 1]);
  });

  test('a throttle band keeps only samples between its floor and ceiling', () => {
    const log = fakeLog([10, 30, 50, 70], [[1000, 1000, 1000, 1000]]);
    expect(Array.from(stepResponseMask(log, { minThrottle: 25, maxThrottle: 55 }))).toEqual([0, 1, 1, 0]);
  });

  test('a motor pinned at full or minimum output marks the sample unusable', () => {
    const log = fakeLog([50, 50, 50, 50], [
      [1000, 2047, 1000, 48],
      [1000, 1000, 1000, 1000],
    ]);
    expect(Array.from(stepResponseMask(log, { excludeSaturation: true }))).toEqual([1, 0, 1, 0]);
  });

  test('saturation is ignored when the motor range header is missing', () => {
    const log = fakeLog([50, 50], [[2047, 48]], '');
    expect(Array.from(stepResponseMask(log, { excludeSaturation: true }))).toEqual([1, 1]);
  });

  test('with no options every sample is usable', () => {
    const log = fakeLog([0, 0, 0], [[48, 48, 48]]);
    expect(Array.from(stepResponseMask(log, {}))).toEqual([1, 1, 1]);
  });
});
