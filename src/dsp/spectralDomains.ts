import type { ParsedLog } from '../types';

/**
 * Per-sample X-domain signals used to bin the gyro spectrum (see
 * `computeBinnedSpectrogram`). Kept here so the throttle and RPM derivations —
 * both a little fiddly (PWM scaling, eRPM pole conversion) — live in one place.
 */

/** Default electrical pole pairs (14-pole motor). Matches the RPM-markers UI. */
export const DEFAULT_POLE_PAIRS = 7;

/**
 * Throttle percentage (0–100) per sample, from `rcCommand[3]` (1000–2000 PWM in
 * Betaflight / INAV). Clamped defensively.
 */
export function throttlePercentSeries(log: ParsedLog): Float32Array {
  const raw = log.rcCommand[3];
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const p = (raw[i]! - 1000) / 10;
    out[i] = p < 0 ? 0 : p > 100 ? 100 : p;
  }
  return out;
}

/**
 * Mean mechanical motor RPM per sample, averaged across all motors with eRPM
 * telemetry. Betaflight logs eRPM as electrical_RPM / 100, so
 * mechanical RPM = eRPM_logged * 100 / polePairs (mirrors `computeRpmMarkers`).
 * Returns null if no motor has usable eRPM data.
 */
export function motorRpmSeries(
  log: ParsedLog,
  polePairs: number = DEFAULT_POLE_PAIRS,
): Float32Array | null {
  const motors = log.eRpm.filter((a) => a.length === log.time.length && a.some((v) => v > 0));
  if (motors.length === 0 || polePairs <= 0) return null;

  const n = log.time.length;
  const scale = 100 / polePairs;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (const m of motors) {
      const v = m[i]!;
      if (Number.isFinite(v) && v > 0) {
        sum += v;
        count++;
      }
    }
    out[i] = count > 0 ? (sum / count) * scale : 0;
  }
  return out;
}

/** Robust upper bound for the RPM axis: the 99.5th percentile, rounded up to a
 *  tidy step, so a few telemetry spikes don't stretch the whole scale. */
export function rpmAxisMax(rpm: Float32Array): number {
  const positive = Array.from(rpm).filter((v) => v > 0);
  if (positive.length === 0) return 1;
  positive.sort((a, b) => a - b);
  const p = positive[Math.min(positive.length - 1, Math.floor(positive.length * 0.995))]!;
  const step = 5000;
  return Math.max(step, Math.ceil(p / step) * step);
}
