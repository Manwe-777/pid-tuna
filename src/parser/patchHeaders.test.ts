import { describe, expect, test } from 'vitest';

import { patchHeaders } from './patchHeaders';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

const header = (firmware: string, debugMode: string) =>
  `H Product:Blackbox flight data recorder\nH Firmware revision:${firmware}\nH debug_mode:${debugMode}\nH gyro_debug_mode:97\n` +
  '\u0000\u0001frames';

describe('patchHeaders', () => {
  test('a year-numbered firmware version becomes 4.4.0, padded to the same length', () => {
    const { patched, originals } = patchHeaders(enc(header('Betaflight 2026.6.0-alpha (norevision) STM32F405', '6')));

    expect(dec(patched)).toContain('H Firmware revision:Betaflight 4.4.0          (norevision) STM32F405\n');
    expect(originals[0]!.firmwareLine).toBe('Betaflight 2026.6.0-alpha (norevision) STM32F405');
  });

  test('a supported version is left alone', () => {
    const input = enc(header('Betaflight 4.4.3 (738127e7e) STM32F405', '6'));

    expect(dec(patchHeaders(input).patched)).toBe(dec(input));
  });

  test('a debug mode the parser does not know becomes zeros, and the real value is kept', () => {
    const { patched, originals } = patchHeaders(enc(header('Betaflight 4.4.3', '97')));

    expect(dec(patched)).toContain('\nH debug_mode:00\n');
    expect(dec(patched)).toContain('H gyro_debug_mode:97');
    expect(originals[0]!.debugMode).toBe(97);
  });

  test('every flight in a file is patched, each keeping its own original values', () => {
    const file = header('Betaflight 2026.6.0', '97') + header('Betaflight 2025.12.1', '3');
    const { patched, originals } = patchHeaders(enc(file));
    const text = dec(patched);

    expect(patched.byteLength).toBe(enc(file).byteLength);
    expect(text.match(/Betaflight 4\.4\.0/g)).toHaveLength(2);
    expect(originals.map((o) => [o.firmwareLine, o.debugMode])).toEqual([
      ['Betaflight 2026.6.0', 97],
      ['Betaflight 2025.12.1', 3],
    ]);
  });

  test('the input buffer is never modified', () => {
    const input = enc(header('Betaflight 2026.6.0', '97'));
    const before = dec(input);
    patchHeaders(input);

    expect(dec(input)).toBe(before);
  });
});
