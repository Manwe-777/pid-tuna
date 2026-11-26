import type { ParsedLog } from '../types';

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
