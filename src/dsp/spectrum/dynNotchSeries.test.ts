import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../../types';
import { dynNotchMedians } from './dynNotchMedians';
import { dynNotchSeries } from './dynNotchSeries';
import { motorHzSeries } from './motorHzSeries';

const fake = (debugMode: string, debug: number[][], extra: Partial<ParsedLog> = {}) =>
  ({
    setup: { debugMode, rawHeaders: {} },
    debug: debug.map((d) => Float32Array.from(d)),
    time: new Float32Array(3),
    eRpm: [],
    ...extra,
  }) as unknown as ParsedLog;

describe('dynamic notch frequencies', () => {
  test('FFT_FREQ debug channels 1 and up are notch centres; channel 0 is not', () => {
    const notches = dynNotchSeries(
      fake('FFT_FREQ', [
        [999, 999, 999],
        [150, 160, 170],
        [300, 310, 0],
        [0, 0, 0],
      ]),
    );
    expect(notches!.map((n) => Array.from(n))).toEqual([
      [150, 160, 170],
      [300, 310, 0],
    ]);
  });

  test('other debug modes do not produce notch lines', () => {
    expect(
      dynNotchSeries(
        fake('GYRO_SCALED', [
          [1, 2, 3],
          [150, 160, 170],
        ]),
      ),
    ).toBeNull();
  });
});

describe('motor rotation frequency', () => {
  test('eRPM / 100 with 14 poles converts to Hz, and stopped motors read 0', () => {
    const log = fake('NONE', [], {
      time: new Float32Array(2),
      eRpm: [Float32Array.of(126, 0)],
      setup: { debugMode: 'NONE', rawHeaders: { motor_poles: '14' } },
    } as unknown as Partial<ParsedLog>);
    expect(Array.from(motorHzSeries(log)![0]!)).toEqual([30, 0]);
  });

  test('no RPM telemetry means no motor frequency', () => {
    expect(motorHzSeries(fake('NONE', []))).toBeNull();
  });
});

describe('median dynamic notch frequencies', () => {
  test('each notch reports the median of its active values', () => {
    expect(
      dynNotchMedians(
        fake('FFT_FREQ', [
          [0, 0, 0, 0],
          [150, 0, 170, 160],
          [300, 320, 310, 0],
        ]),
      ),
    ).toEqual([160, 310]);
  });
});
