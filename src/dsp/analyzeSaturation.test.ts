import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../types';
import { analyzeSaturation } from './analyzeSaturation';

const FS = 100;

/** 10 s log: 2 s on the ground, 6 s flying, 2 s landed. `iTerm(i)` gives the roll I term at sample i. */
function fakeLog(firmwareVersion: string, headers: Record<string, string>, iTerm: (i: number) => number): ParsedLog {
  const n = 10 * FS;
  const throttle = Float32Array.from({ length: n }, (_, i) => (i >= 2 * FS && i < 8 * FS ? 1400 : 1000));
  const zeros = new Float32Array(n);

  return {
    time: Float32Array.from({ length: n }, (_, i) => i / FS),
    iTerm: [Float32Array.from({ length: n }, (_, i) => iTerm(i)), zeros, zeros],
    rcCommand: [zeros, zeros, zeros, throttle],
    setup: { firmwareVersion, rawHeaders: headers, sampleRateHz: FS },
  } as unknown as ParsedLog;
}

describe('I-term saturation', () => {
  test('Betaflight 2025+ limits are iterm_windup × pidsum_limit, with yaw on its own sum limit', () => {
    const a = analyzeSaturation(
      fakeLog('2025.12.1', { iterm_windup: '80', pidsum_limit: '500', pidsum_limit_yaw: '400' }, () => 0),
    );
    expect(a.limitSource).toBe('windup');
    expect(a.axes.map((x) => x.limit)).toEqual([400, 400, 320]);
  });

  test('older Betaflight falls back to the default 400 and says so', () => {
    const a = analyzeSaturation(fakeLog('4.4.3', { iterm_windup: '85', pidsum_limit: '500' }, () => 0));
    expect(a.limitSource).toBe('default');
    expect(a.itermLimit).toBe(400);
  });

  test('an iterm_limit header is used when present', () => {
    expect(analyzeSaturation(fakeLog('4.2.0', { iterm_limit: '250' }, () => 0)).itermLimit).toBe(250);
  });

  test('one second pinned at the limit in a six-second flight is a sixth of the flight', () => {
    const a = analyzeSaturation(fakeLog('4.4.3', {}, (i) => (i >= 4 * FS && i < 5 * FS ? -399 : 50)));
    expect(a.axes[0]!.fraction).toBeCloseTo(1 / 6, 2);
    expect(a.axes[0]!.runs).toHaveLength(1);
    expect(a.axes[0]!.longestRunSec).toBeCloseTo(0.99, 2);
  });

  test('I term wound up on the ground before takeoff is not counted', () => {
    const a = analyzeSaturation(fakeLog('4.4.3', {}, (i) => (i < FS ? 400 : 0)));
    expect(a.axes[0]!.fraction).toBe(0);
    expect(a.axes[0]!.runs).toHaveLength(0);
  });
});
