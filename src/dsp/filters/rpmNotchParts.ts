import type { FilterPart } from '../../types';

/** Betaflight keeps RPM notch centres below 0.48 × the loop rate. */
const RPM_MAX_FRACTION = 0.48;

/**
 * RPM notches the way Betaflight runs them: one per harmonic (per motor), centred
 * on harmonic × fundamental (kept between the minimum frequency and 0.48 × the
 * loop rate), weighted by `rpm_filter_weights` and faded out as the fundamental
 * approaches the minimum: 0% at the minimum, full weight at minimum + fade range.
 */
export function rpmNotchParts(
  fundamentalHz: number,
  harmonics: number,
  q: number,
  minHz: number,
  fadeHz: number,
  weightsPct: number[],
  motors: number,
  loopHz: number,
): FilterPart[] {
  const above = fundamentalHz - minHz;
  const fade = above <= 0 ? 0 : fadeHz > 0 ? Math.min(1, above / fadeHz) : 1;
  const parts: FilterPart[] = [];

  for (let h = 1; h <= harmonics; h++) {
    const weight = ((weightsPct[h - 1] ?? 100) / 100) * fade;
    if (weight <= 0) continue;

    const hz = Math.min(Math.max(fundamentalHz * h, minHz), RPM_MAX_FRACTION * loopHz);
    parts.push({ kind: 'notch', hz, q, weight, copies: motors });
  }

  return parts;
}
