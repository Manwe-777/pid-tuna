import type { ParsedLog } from '../types';
import { dynNotchSeries } from './dynNotchSeries';

/** Median centre frequency of each dynamic notch while active, Hz. Empty outside FFT_FREQ debug mode. */
export function dynNotchMedians(log: ParsedLog): number[] {
  const notches = dynNotchSeries(log);
  if (!notches) return [];

  return notches.map((n) => {
    const active = Array.from(n).filter((v) => v > 0).sort((a, b) => a - b);

    return active[active.length >> 1] ?? 0;
  }).filter((hz) => hz > 0);
}
