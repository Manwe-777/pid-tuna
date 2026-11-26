import type { Biquad, FilterSpec } from '../../types';
import { filterPartSections } from './filterPartSections';
import { specParts } from './specParts';

/** Sections for the enabled filters, built with Betaflight's filter maths at `loopHz`. */
export function chainSections(filters: ReadonlyArray<FilterSpec>, loopHz: number): Biquad[] {
  return filters.flatMap((f) => specParts(f, loopHz)).flatMap((p) => filterPartSections(p, loopHz));
}
