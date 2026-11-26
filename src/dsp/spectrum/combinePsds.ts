import type { PsdResult } from '../../types';
import { flooredDb } from './flooredDb';

/**
 * Pool multiple Welch PSDs into one. Averages in *linear* power weighted by
 * each input's window count (proper Welch combining), then converts back to
 * dB. PSDs with a different number of frequency bins than the first non-empty
 * result are skipped — those would have been produced with a different FFT
 * size or sample rate and can't be averaged without resampling.
 */
export function combinePsds(results: PsdResult[], floorDb = -200): PsdResult {
  if (results.length === 0) {
    return { frequencies: new Float32Array(), psdDb: new Float32Array(), numWindows: 0 };
  }

  if (results.length === 1) return results[0]!;

  const ref = results.find((r) => r.psdDb.length > 0 && r.numWindows > 0) ?? results[0]!;
  const bins = ref.frequencies.length;
  if (bins === 0) return ref;

  const { accum, totalWindows } = weightedLinearPower(results, bins);
  if (totalWindows === 0) return ref;

  const psdDb = new Float32Array(bins);
  const inv = 1 / totalWindows;
  for (let f = 0; f < bins; f++) psdDb[f] = flooredDb(accum[f]! * inv, 10, floorDb);

  return { frequencies: ref.frequencies, psdDb, numWindows: totalWindows };
}

/** Σ linear power × window count over the PSDs with `bins` bins, and the total window count. */
function weightedLinearPower(results: PsdResult[], bins: number): { accum: Float64Array; totalWindows: number } {
  const accum = new Float64Array(bins);
  let totalWindows = 0;

  for (const r of results) {
    if (r.psdDb.length !== bins || r.numWindows <= 0) continue;
    const w = r.numWindows;

    for (let f = 0; f < bins; f++) {
      accum[f] = accum[f]! + Math.pow(10, r.psdDb[f]! / 10) * w;
    }

    totalWindows += w;
  }

  return { accum, totalWindows };
}
