import '../../parser/compat';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseLog } from '../../parser/parseLog';
import { motorHarmonicNoise } from './motorHarmonicNoise';
import { motorHzSeries } from './motorHzSeries';

const PATH = join(process.env.PIDTUNA_LOG_DIR ?? '', 'pid', 'LOG00005.BFL');
const available = Boolean(process.env.PIDTUNA_LOG_DIR) && existsSync(PATH);

/**
 * PIDtoolbox's Spectral Analyzer "Roll Motor Noise (dB)" for this log,
 * harmonics 1–3. Its PSD divides by window length; pid-tuna's divides by window
 * power, which for a Hann window reads 10·log10(1 / 0.375) = 4.26 dB higher.
 * Unfiltered gyro has sharp peaks that PIDtoolbox places using the nominal
 * 1.6 kHz logging rate while the log's timestamps give 1618 Hz, and its spread
 * across ~380 segments is 5–7 dB, so it is compared to 0.75 dB.
 */
const PIDTOOLBOX = { gyro: [-36.65, -36.24, -41.08], unfiltered: [-19.44, -7.92, -22.74] };
const WINDOW_POWER_DB = 10 * Math.log10(1 / 0.375);

describe.skipIf(!available)('motor harmonic noise compared with PIDtoolbox', () => {
  const loaded = available ? parseLog(new File([readFileSync(PATH)], 'LOG00005.BFL')) : null;

  test.each([
    ['gyro', 'gyroFilt', 0.3],
    ['unfiltered', 'gyroRaw', 0.75],
  ] as const)(
    'roll %s noise at each harmonic is PIDtoolbox’s plus the window-power offset, within %f dB',
    async (key, field, tolerance) => {
      const log = (await loaded)!;
      const levels = motorHarmonicNoise(log[field][0]!, motorHzSeries(log)!, log.setup.sampleRateHz);
      levels.forEach((h, i) =>
        expect(Math.abs(h.meanDb! - (PIDTOOLBOX[key][i]! + WINDOW_POWER_DB))).toBeLessThan(tolerance),
      );
    },
  );
});
