import { bfFilterSections, type Biquad } from './bfFilterSections';
import type { FilterPart } from './filterPart';

/**
 * Sections for one filter part. A weighted notch blends its numerator with
 * its denominator, b' = w·b + (1 − w)·a, which is y = (1 − w)·x + w·H(x);
 * copies repeat the sections in series.
 */
export function filterPartSections(part: FilterPart, loopHz: number): Biquad[] {
  const w = part.weight ?? 1;
  if (w <= 0) return [];

  const sections = bfFilterSections(part, loopHz).map((s) =>
    w >= 1
      ? s
      : { b0: w * s.b0 + (1 - w), b1: w * s.b1 + (1 - w) * s.a1, b2: w * s.b2 + (1 - w) * s.a2, a1: s.a1, a2: s.a2 },
  );

  return Array.from({ length: Math.max(1, part.copies ?? 1) }, () => sections).flat();
}
