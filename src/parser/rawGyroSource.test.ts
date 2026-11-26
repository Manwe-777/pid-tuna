import { describe, expect, test } from 'vitest';

import { rawGyroSource } from './rawGyroSource';

describe('where unfiltered gyro comes from', () => {
  test('the gyroUnfilt field wins whenever it was logged', () => {
    expect(rawGyroSource(true, true, 'FFT_FREQ')).toBe('gyroUnfilt');
  });

  test('debug channels count only in GYRO_SCALED mode, however the name is spelled', () => {
    expect(rawGyroSource(false, true, 'GYRO_SCALED')).toBe('debug');
    expect(rawGyroSource(false, true, 'GyroScaled')).toBe('debug');
  });

  test('GYRO_RAW is raw sensor counts, not usable as unfiltered gyro', () => {
    expect(rawGyroSource(false, true, 'GYRO_RAW')).toBeNull();
  });

  test('unrelated debug modes are not gyro', () => {
    expect(rawGyroSource(false, true, 'BATTERY')).toBeNull();
    expect(rawGyroSource(false, true, 'FFT_FREQ')).toBeNull();
  });
});
