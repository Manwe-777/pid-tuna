import { describe, expect, test } from 'vitest';
import { buildTuneView } from './buildTuneView';
import type { ParsedLog } from '../types';

const view = (rawHeaders: Record<string, string>) => buildTuneView({ setup: { rawHeaders } } as unknown as ParsedLog);

describe('tune settings from log headers', () => {
  test('Betaflight 4.3+ filter headers are read', () => {
    const v = view({
      looptime: '125',
      pid_process_denom: '2',
      gyro_lpf1_type: '0',
      gyro_lpf1_static_hz: '0',
      gyro_lpf1_dyn_hz: '250,500',
      gyro_lpf2_type: '0',
      gyro_lpf2_static_hz: '500',
      gyro_notch_hz: '0,0',
      gyro_notch_cutoff: '0,0',
      dterm_lpf1_type: '0',
      dterm_lpf1_static_hz: '75',
      dterm_lpf1_dyn_hz: '75,150',
      dterm_lpf2_type: '3',
      dterm_lpf2_static_hz: '150',
      rpm_filter_weights: '90,30,90',
    });
    expect(v.gyroDynRange).toEqual({ min: 250, max: 500 });
    expect(v.gyroLpf2Hz).toBe(500);
    expect(v.dtermDynRange).toEqual({ min: 75, max: 150 });
    expect(v.dtermLpf2Hz).toBe(150);
    expect(v.dtermLpf2Type).toBe(3);
    expect(v.gyroNotch1Hz).toBe(0);
    expect(v.rpmWeights).toEqual([90, 30, 90]);
    expect(v.gyroRateHz).toBe(8000);
    expect(v.pidRateHz).toBe(4000);
  });

  test('a dynamic lowpass with minimum 0 is off and the static cutoff applies', () => {
    const v = view({ gyro_lpf1_static_hz: '250', gyro_lpf1_dyn_hz: '0,500' });
    expect(v.gyroDynRange).toBeUndefined();
    expect(v.gyroLpf1Hz).toBe(250);
  });

  test('pre-4.3 header names still work', () => {
    const v = view({
      gyro_lowpass_hz: '200',
      dyn_lpf_gyro_min_hz: '200',
      dyn_lpf_gyro_max_hz: '500',
      dterm_lpf_hz: '100',
    });
    expect(v.gyroLpf1Hz).toBe(200);
    expect(v.gyroDynRange).toEqual({ min: 200, max: 500 });
    expect(v.dtermLpf1Hz).toBe(100);
  });
});
