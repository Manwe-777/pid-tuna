import { describe, expect, test } from 'vitest';

import { tuneCliCommands } from './tuneCliCommands';

const headers = {
  rollPID: '45,80,30',
  pitchPID: '47,84,34',
  yawPID: '45,80,0',
  d_max: '40,46,0',
  ff_weight: '120,125,120',
  rc_rates: '7,7,7',
  rates: '67,67,67',
  rates_type: '3',
  gyro_lpf1_type: '0',
  gyro_lpf1_static_hz: '250',
  gyro_lpf1_dyn_hz: '250,500',
  dterm_lpf1_type: '2',
  iterm_relax: '1',
  rpm_filter_weights: '100,100,100',
  motor_poles: '14',
  'Firmware revision': 'Betaflight 4.5.1',
};

const lines = (text: string) => text.split('\n').filter((l) => l.startsWith('set '));

describe('tuneCliCommands', () => {
  test('PIDs become p_, i_ and d_ settings per axis', () => {
    const out = lines(tuneCliCommands(headers, 'LOG1'));

    expect(out).toContain('set p_roll = 45');
    expect(out).toContain('set i_pitch = 84');
    expect(out).toContain('set d_yaw = 0');
  });

  test('per-axis lists split into one setting per axis', () => {
    const out = lines(tuneCliCommands(headers, 'LOG1'));

    expect(out).toEqual(expect.arrayContaining(['set d_max_pitch = 46', 'set f_yaw = 120', 'set roll_srate = 67']));
  });

  test('enums logged as numbers are written by name', () => {
    const out = lines(tuneCliCommands(headers, 'LOG1'));

    expect(out).toEqual(
      expect.arrayContaining([
        'set rates_type = ACTUAL',
        'set gyro_lpf1_type = PT1',
        'set dterm_lpf1_type = PT2',
        'set iterm_relax = RP',
      ]),
    );
  });

  test('a dynamic lowpass range becomes its min and max settings', () => {
    const out = lines(tuneCliCommands(headers, 'LOG1'));

    expect(out).toEqual(expect.arrayContaining(['set gyro_lpf1_dyn_min_hz = 250', 'set gyro_lpf1_dyn_max_hz = 500']));
  });

  test('array settings keep their comma list', () => {
    expect(lines(tuneCliCommands(headers, 'LOG1'))).toContain('set rpm_filter_weights = 100,100,100');
  });

  test('headers that are not tune settings, and settings the log lacks, are left out', () => {
    const out = tuneCliCommands(headers, 'LOG1');

    expect(out).not.toContain('motor_poles');
    expect(out).not.toContain('Firmware');
    expect(out).not.toContain('dyn_notch');
  });

  test('an enum number outside the known names is written as the number', () => {
    expect(lines(tuneCliCommands({ gyro_lpf1_type: '9' }, 'LOG1'))).toEqual(['set gyro_lpf1_type = 9']);
  });

  test('the dump never saves on its own', () => {
    expect(lines(tuneCliCommands(headers, 'LOG1')).some((l) => l.trim() === 'save')).toBe(false);
  });
});
