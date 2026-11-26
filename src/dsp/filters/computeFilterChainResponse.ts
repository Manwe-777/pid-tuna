import type { FilterResponseResult, FilterSpec } from '../../types';
import { biquadChainResponse } from './biquadChainResponse';
import { chainSections } from './chainSections';

/** Frequency response of the enabled chain running at `loopHz`, at each frequency in `frequencies`. */
export function computeFilterChainResponse(
  filters: ReadonlyArray<FilterSpec>,
  loopHz: number,
  frequencies: Float32Array,
): FilterResponseResult {
  const sections = chainSections(filters, loopHz);
  const N = frequencies.length;
  const magnitudeDb = new Float32Array(N);
  const phaseDelayMs = new Float32Array(N);
  let unwrap = 0;
  let last = 0;

  for (let i = 0; i < N; i++) {
    const f = frequencies[i]!;
    const r = biquadChainResponse(sections, f, loopHz);
    magnitudeDb[i] = 20 * Math.log10(Math.max(1e-12, r.magnitude));

    if (i > 0 && r.phase + unwrap - last > Math.PI) unwrap -= 2 * Math.PI;
    else if (i > 0 && r.phase + unwrap - last < -Math.PI) unwrap += 2 * Math.PI;
    last = r.phase + unwrap;
    phaseDelayMs[i] = f > 0 ? (-last / (2 * Math.PI * f)) * 1000 : Number.NaN;
  }

  if (N > 1 && Number.isNaN(phaseDelayMs[0]!)) phaseDelayMs[0] = phaseDelayMs[1]!;

  return { frequencies, magnitudeDb, phaseDelayMs, hasFilters: sections.length > 0 };
}
