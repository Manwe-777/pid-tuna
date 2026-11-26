import { describe, expect, test } from 'vitest';
import { bfFilterSections } from './bfFilterSections';
import { biquadChainResponse } from './biquadChainResponse';

const LOOP = 8000;
const db = (kind: 'pt1' | 'pt2' | 'pt3' | 'biquad', hz: number, at: number) =>
  20 * Math.log10(biquadChainResponse(bfFilterSections({ kind, hz }, LOOP), at, LOOP).magnitude);

describe('Betaflight filter sections', () => {
  test.each(['pt1', 'pt2', 'pt3', 'biquad'] as const)('a %s set to 100 Hz is 3 dB down at 100 Hz', (kind) => {
    expect(db(kind, 100, 100)).toBeCloseTo(-3, 0);
  });

  test('higher-order lowpasses roll off faster above the cutoff', () => {
    expect(db('pt2', 100, 400)).toBeLessThan(db('pt1', 100, 400) - 5);
    expect(db('pt3', 100, 400)).toBeLessThan(db('pt2', 100, 400) - 3);
  });

  test('lowpasses pass 0 Hz untouched', () => {
    for (const kind of ['pt1', 'pt2', 'pt3', 'biquad'] as const) expect(db(kind, 100, 0.001)).toBeCloseTo(0, 3);
  });

  test('a notch removes its centre frequency and leaves far frequencies alone', () => {
    const sections = bfFilterSections({ kind: 'notch', hz: 200, q: 3 }, LOOP);
    expect(biquadChainResponse(sections, 200, LOOP).magnitude).toBeLessThan(1e-3);
    expect(biquadChainResponse(sections, 20, LOOP).magnitude).toBeCloseTo(1, 2);
  });

  test('a cutoff at or above Nyquist produces no filter', () => {
    expect(bfFilterSections({ kind: 'pt1', hz: 4000 }, LOOP)).toHaveLength(0);
  });
});
