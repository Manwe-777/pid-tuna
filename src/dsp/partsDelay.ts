import { bfFilterSections } from './bfFilterSections';
import { biquadChainResponse } from './biquadChainResponse';
import type { FilterPart } from './filterPart';

/** Phase delay and lag of filter parts in series at one frequency. */
export function partsDelay(parts: FilterPart[], loopHz: number, hz: number): { delayMs: number; phaseDeg: number } {
  let phase = 0;

  for (const p of parts) {
    const sections = bfFilterSections(p, loopHz);
    if (sections.length === 0) continue;

    const r = biquadChainResponse(sections, hz, loopHz);
    const w = p.weight ?? 1;
    const re = 1 - w + w * r.magnitude * Math.cos(r.phase);
    const im = w * r.magnitude * Math.sin(r.phase);
    phase += Math.atan2(im, re) * (p.copies ?? 1);
  }

  return { delayMs: (-phase / (2 * Math.PI * hz)) * 1000, phaseDeg: (phase * 180) / Math.PI };
}
