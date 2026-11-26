import type { FilterSpec } from '../../types';
import { chainSections } from './chainSections';

/**
 * Apply a sequential filter chain to `signal` sampled at `sampleRateHz`.
 * Returns a new Float32Array; the input is not mutated.
 */
export function applyFilterChain(
  signal: Float32Array,
  sampleRateHz: number,
  filters: ReadonlyArray<FilterSpec>,
): Float32Array {
  const out = signal.slice();
  if (sampleRateHz <= 0) return out;

  for (const s of chainSections(filters, sampleRateHz)) {
    let z1 = 0;
    let z2 = 0;

    for (let i = 0; i < out.length; i++) {
      const x = out[i]!;
      const y = s.b0 * x + z1;
      z1 = s.b1 * x - s.a1 * y + z2;
      z2 = s.b2 * x - s.a2 * y;
      out[i] = y;
    }
  }

  return out;
}
