import { describe, expect, test } from 'vitest';

import { filterTestSignal } from './filterTestSignal';
import { computeFilterChainResponse, DEFAULT_FILTER_SPECS, type FilterSpec } from './filters';

const LOOP = 8000;
const spec = (over: Partial<FilterSpec>): FilterSpec => ({
  ...DEFAULT_FILTER_SPECS[over.type ?? 'pt1'],
  id: 'x',
  ...over,
});

describe('filter test signals', () => {
  test('a PT1 step response follows 1 − (1 − k)^(n+1)', () => {
    const r = filterTestSignal([spec({ type: 'pt1', cutoffHz: 100 })], LOOP, 'step');
    const omega = (2 * Math.PI * 100) / LOOP;
    const k = omega / (omega + 1);
    for (const n of [0, 10, 100]) expect(r.output[n]!).toBeCloseTo(1 - (1 - k) ** (n + 1), 6);
  });

  test('a lowpass impulse response adds up to 1 (it passes 0 Hz untouched)', () => {
    const r = filterTestSignal([spec({ type: 'pt2', cutoffHz: 150 })], LOOP, 'impulse');
    expect(r.output.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
  });

  test('a chirp sweeps from its start to its end frequency', () => {
    const r = filterTestSignal([], LOOP, 'chirp', { startHz: 10, endHz: 500, duration: 1 });
    const zeroCrossings = (from: number, to: number) => {
      let c = 0;
      for (let i = from + 1; i < to; i++) if (Math.sign(r.input[i]!) !== Math.sign(r.input[i - 1]!)) c++;
      return c;
    };
    const late = zeroCrossings(LOOP * 0.9, LOOP) / 2 / 0.1;
    expect(Math.abs(late - (10 + 490 * 0.95))).toBeLessThan(20);
  });

  test('a lowpass shrinks the high end of a chirp as its response curve says', () => {
    const chain = [spec({ type: 'pt1', cutoffHz: 100 })];
    const r = filterTestSignal(chain, LOOP, 'chirp', { startHz: 400, endHz: 400.001, duration: 1 });
    const tail = r.output.slice(LOOP / 2);
    const amplitude = Math.max(...tail.map(Math.abs));
    const expected = 10 ** (computeFilterChainResponse(chain, LOOP, Float32Array.of(400)).magnitudeDb[0]! / 20);
    expect(amplitude).toBeCloseTo(expected, 2);
  });

  test('noise is reproducible and only added when asked for', () => {
    const clean = filterTestSignal([], LOOP, 'chirp', { startHz: 10, endHz: 20, duration: 0.1 });
    const noisy = filterTestSignal([], LOOP, 'chirp', { startHz: 10, endHz: 20, duration: 0.1, noise: 0.2 });
    const again = filterTestSignal([], LOOP, 'chirp', { startHz: 10, endHz: 20, duration: 0.1, noise: 0.2 });
    expect(Array.from(noisy.input)).toEqual(Array.from(again.input));
    expect(noisy.input[5]).not.toBe(clean.input[5]);
  });
});

describe('RPM and dynamic notch blocks', () => {
  test('a weighted RPM notch at half weight passes half of its centre frequency', () => {
    const chain = [spec({ type: 'rpm', cutoffHz: 200, count: 1, weights: [50], motors: 1, fadeHz: 0, minHz: 100 })];
    const db = computeFilterChainResponse(chain, LOOP, Float32Array.of(200)).magnitudeDb[0]!;
    expect(10 ** (db / 20)).toBeCloseTo(0.5, 2);
  });

  test('two dynamic notches delay twice as much as one', () => {
    const one = computeFilterChainResponse(
      [spec({ type: 'dynNotch', cutoffHz: 150, count: 1 })],
      LOOP,
      Float32Array.of(25),
    ).phaseDelayMs[0]!;
    const two = computeFilterChainResponse(
      [spec({ type: 'dynNotch', cutoffHz: 150, count: 2 })],
      LOOP,
      Float32Array.of(25),
    ).phaseDelayMs[0]!;
    expect(two).toBeCloseTo(2 * one, 6);
  });
});
