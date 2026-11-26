import { describe, expect, test } from 'vitest';

import { debugModeName } from './debugModeName';
import { featureNames } from './featureNames';
import { firmwareInfo } from './firmwareInfo';
import { motorProtocolName } from './motorProtocolName';

const fw = (revision: string) => firmwareInfo(new Map([['Firmware revision', revision]]));

describe('firmwareInfo', () => {
  test('reads name and version, keeping the build details in the version text', () => {
    expect(fw('Betaflight 4.4.3 (738127e7e) STM32F405')).toEqual({
      kind: 'Betaflight',
      version: '4.4.3 (738127e7e) STM32F405',
      major: 4,
      minor: 4,
      patch: 3,
    });
  });

  test('year versions, prereleases and other firmware', () => {
    expect(fw('Betaflight 2026.6.0-alpha (norevision) STM32F405')).toMatchObject({ major: 2026, minor: 6 });
    expect(fw('INAV 7.1.2 (deadbeef) MATEKF405')).toMatchObject({ kind: 'INAV', major: 7 });
    expect(fw('EmuFlight 0.4.1 (abc) STM32F7X2').kind).toBe('EmuFlight');
  });

  test('an unreadable revision keeps its text and the firmware type header', () => {
    const info = firmwareInfo(new Map([['Firmware type', 'Cleanflight']]));
    expect(info).toMatchObject({ kind: 'Cleanflight', major: 0 });
  });
});

describe('debugModeName', () => {
  test('Betaflight 4.x names follow the renames of each release', () => {
    expect(debugModeName(20, fw('Betaflight 4.4.3'))).toBe('GYRO_RAW');
    expect(debugModeName(6, fw('Betaflight 4.4.3'))).toBe('GYRO_SCALED');
    expect(debugModeName(6, fw('Betaflight 3.3.0'))).toBe('NOTCH');
    expect(debugModeName(19, fw('Betaflight 3.5.0'))).toBe('GYRO_RAW');
  });

  test('year versions use the renumbered list', () => {
    expect(debugModeName(16, fw('Betaflight 2026.6.0-alpha'))).toBe('FFT_FREQ');
    expect(debugModeName(97, fw('Betaflight 2025.12.1'))).toBe('CHIRP');
  });

  test('modes the firmware list doesn’t have, or other firmware, stay unnamed', () => {
    expect(debugModeName(250, fw('Betaflight 4.4.3'))).toBe('Unknown (250)');
    expect(debugModeName(3, fw('INAV 7.1.2'))).toBe('Unknown (3)');
    expect(debugModeName(null, fw('Betaflight 4.4.3'))).toBe('NONE');
  });
});

describe('features and motor protocol', () => {
  test('feature bits read as Betaflight’s names', () => {
    expect(featureNames(268698632)).toEqual(['RX_SERIAL', 'TELEMETRY', 'OSD', 'ANTI_GRAVITY']);
    expect(featureNames(1 << 30)).toEqual(['BIT_30']);
  });

  test('motor protocol by number', () => {
    expect(motorProtocolName(6)).toBe('DSHOT300');
    expect(motorProtocolName(8)).toBe('PROSHOT1000');
    expect(motorProtocolName(null)).toBeUndefined();
  });
});
