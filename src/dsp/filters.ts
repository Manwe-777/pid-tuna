import { type BfFilterKind, bfFilterSections, type Biquad } from './bfFilterSections';
import { biquadChainResponse } from './biquadChainResponse';

export type FilterType = BfFilterKind;

export interface FilterSpec {
  /** Stable React key. */
  id: string;
  enabled: boolean;
  type: FilterType;
  /** Cutoff (for lowpass) or centre (for notch), in Hz. */
  cutoffHz: number;
  /** Notch bandwidth in Hz (Q = centre / bandwidth). Ignored for lowpass filters. */
  bandwidth: number;
}

export const DEFAULT_FILTER_SPECS: Record<FilterType, FilterSpec> = {
  pt1: { id: '', enabled: true, type: 'pt1', cutoffHz: 150, bandwidth: 40 },
  pt2: { id: '', enabled: true, type: 'pt2', cutoffHz: 150, bandwidth: 40 },
  pt3: { id: '', enabled: true, type: 'pt3', cutoffHz: 150, bandwidth: 40 },
  biquad: { id: '', enabled: true, type: 'biquad', cutoffHz: 150, bandwidth: 40 },
  notch: { id: '', enabled: true, type: 'notch', cutoffHz: 200, bandwidth: 40 },
};

/** Sections for the enabled filters, built with Betaflight's filter maths at `loopHz`. */
export function chainSections(filters: ReadonlyArray<FilterSpec>, loopHz: number): Biquad[] {
  return filters
    .filter((f) => f.enabled && Number.isFinite(f.cutoffHz))
    .flatMap((f) =>
      bfFilterSections(
        { kind: f.type, hz: f.cutoffHz, q: f.type === 'notch' && f.bandwidth > 0 ? f.cutoffHz / f.bandwidth : undefined },
        loopHz,
      ),
    );
}

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

let _counter = 0;
export function newFilterId(): string {
  _counter = (_counter + 1) % 1_000_000;
  return `f${Date.now().toString(36)}-${_counter}`;
}

export interface FilterResponseResult {
  frequencies: Float32Array;
  /** |H(f)| in dB. */
  magnitudeDb: Float32Array;
  /** Phase delay −φ(f)/(2πf) in ms. */
  phaseDelayMs: Float32Array;
  /** Whether at least one filter was active when computing this response. */
  hasFilters: boolean;
}

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
