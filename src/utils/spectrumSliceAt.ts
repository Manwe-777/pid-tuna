import type { SpectrogramResult } from '../types';

/** Index of the time bin nearest `t` (times ascending, non-empty). */
function nearestBin(times: Float32Array, t: number): number {
  let lo = 0;
  let hi = times.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid]! < t) lo = mid + 1;
    else hi = mid;
  }

  return lo > 0 && Math.abs(times[lo - 1]! - t) < Math.abs(times[lo]! - t) ? lo - 1 : lo;
}

/** The spectrum at the time bin nearest the cursor, or null without a cursor or bins. */
export function spectrumSliceAt(
  spec: SpectrogramResult | null,
  cursorTime: number | null,
): { freq: Float32Array; values: Float32Array } | null {
  if (!spec || cursorTime == null || spec.times.length === 0) return null;
  const base = nearestBin(spec.times, cursorTime) * spec.freqBins;

  return { freq: spec.frequencies, values: spec.magnitudes.slice(base, base + spec.freqBins) };
}
