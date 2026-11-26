import type { BfFilterKind, Biquad } from './bfFilterSections';
import { biquadChainResponse } from './biquadChainResponse';
import type { FilterPart } from './filterPart';
import { filterPartSections } from './filterPartSections';
import { rpmNotchParts } from './rpmNotchParts';

export type FilterType = BfFilterKind | 'rpm' | 'dynNotch';

export interface FilterSpec {
  /** Stable React key. */
  id: string;
  enabled: boolean;
  type: FilterType;
  /** Cutoff (lowpass), centre (notch, dynamic notch) or motor fundamental (RPM), in Hz. */
  cutoffHz: number;
  /** Notch bandwidth in Hz (Q = centre / bandwidth). */
  bandwidth: number;
  /** RPM and dynamic notch Q, Betaflight scale (500 = Q 5). */
  bfQ?: number;
  /** RPM: harmonics. Dynamic notch: number of notches. */
  count?: number;
  /** RPM: minimum notch frequency, Hz. */
  minHz?: number;
  /** RPM: fade range above the minimum, Hz. */
  fadeHz?: number;
  /** RPM: per-harmonic weights, %. */
  weights?: number[];
  /** RPM: number of motors (one notch set per motor). */
  motors?: number;
}

export const DEFAULT_FILTER_SPECS: Record<FilterType, FilterSpec> = {
  pt1: { id: '', enabled: true, type: 'pt1', cutoffHz: 150, bandwidth: 40 },
  pt2: { id: '', enabled: true, type: 'pt2', cutoffHz: 150, bandwidth: 40 },
  pt3: { id: '', enabled: true, type: 'pt3', cutoffHz: 150, bandwidth: 40 },
  biquad: { id: '', enabled: true, type: 'biquad', cutoffHz: 150, bandwidth: 40 },
  notch: { id: '', enabled: true, type: 'notch', cutoffHz: 200, bandwidth: 40 },
  rpm: {
    id: '',
    enabled: true,
    type: 'rpm',
    cutoffHz: 150,
    bandwidth: 0,
    bfQ: 500,
    count: 3,
    minHz: 100,
    fadeHz: 50,
    weights: [100, 100, 100],
    motors: 4,
  },
  dynNotch: { id: '', enabled: true, type: 'dynNotch', cutoffHz: 150, bandwidth: 0, bfQ: 300, count: 1 },
};

/** The filter parts a spec stands for, in Betaflight terms. */
export function specParts(f: FilterSpec, loopHz: number): FilterPart[] {
  if (!f.enabled || !Number.isFinite(f.cutoffHz)) return [];

  switch (f.type) {
    case 'rpm':
      return rpmNotchParts(
        f.cutoffHz,
        f.count ?? 3,
        (f.bfQ ?? 500) / 100,
        f.minHz ?? 100,
        f.fadeHz ?? 50,
        f.weights ?? [],
        f.motors ?? 4,
        loopHz,
      );
    case 'dynNotch':
      return [{ kind: 'notch', hz: f.cutoffHz, q: (f.bfQ ?? 300) / 100, copies: f.count ?? 1 }];
    case 'notch':
      return f.bandwidth > 0 ? [{ kind: 'notch', hz: f.cutoffHz, q: f.cutoffHz / f.bandwidth }] : [];
    default:
      return [{ kind: f.type, hz: f.cutoffHz }];
  }
}

/** Sections for the enabled filters, built with Betaflight's filter maths at `loopHz`. */
export function chainSections(filters: ReadonlyArray<FilterSpec>, loopHz: number): Biquad[] {
  return filters.flatMap((f) => specParts(f, loopHz)).flatMap((p) => filterPartSections(p, loopHz));
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
