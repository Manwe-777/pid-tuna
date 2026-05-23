// fili ships no types; declare just the surface we use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import Fili from 'fili';

export type FilterType = 'pt1' | 'biquad' | 'notch';

export interface FilterSpec {
  /** Stable React key. */
  id: string;
  enabled: boolean;
  type: FilterType;
  /** Cutoff (for LPF) or center (for notch), in Hz. */
  cutoffHz: number;
  /** Q factor for biquad. Ignored for PT1/notch. */
  q: number;
  /** Notch bandwidth in Hz. Ignored for LPF. */
  bandwidth: number;
}

export const DEFAULT_FILTER_SPECS: Record<FilterType, FilterSpec> = {
  pt1: { id: '', enabled: true, type: 'pt1', cutoffHz: 150, q: 0.7, bandwidth: 40 },
  biquad: { id: '', enabled: true, type: 'biquad', cutoffHz: 150, q: 0.7, bandwidth: 40 },
  notch: { id: '', enabled: true, type: 'notch', cutoffHz: 200, q: 0.7, bandwidth: 40 },
};

interface FiliCoeffs {
  /** Feedforward coefficients [b0, b1, b2] (normalized so a0 = 1). */
  readonly b: number[];
  /** Feedback coefficients [a1, a2] (a0 = 1 implied). */
  readonly a: number[];
  /** Delay registers. */
  readonly z?: number[];
  readonly k?: number;
  readonly [key: string]: unknown;
}
interface FiliFilter {
  multiStep(input: ArrayLike<number>, overwrite?: boolean): number[];
}
interface FiliApi {
  CalcCascades: new () => {
    lowpass(p: {
      order: number;
      characteristic?: string;
      Fs: number;
      Fc: number;
      Q?: number;
    }): FiliCoeffs[];
  };
  /**
   * Low-level coefficient calculator. We use this directly for cases where the
   * Butterworth cascade in `CalcCascades` would overwrite our user-provided Q
   * (notch, biquad LPF with non-Butterworth Q).
   */
  IirCoeffs: new () => {
    lowpass(p: { Fs: number; Fc: number; Q: number }): FiliCoeffs;
    bandstop(p: { Fs: number; Fc: number; Q: number }): FiliCoeffs;
  };
  IirFilter: new (coeffs: FiliCoeffs[]) => FiliFilter;
}

const fili = Fili as unknown as FiliApi;

/**
 * Apply a sequential filter chain to `signal`. Returns a new Float32Array; the
 * input is not mutated. Disabled or invalid specs are skipped.
 */
export function applyFilterChain(
  signal: Float32Array,
  sampleRateHz: number,
  filters: ReadonlyArray<FilterSpec>,
): Float32Array {
  if (signal.length === 0 || sampleRateHz <= 0 || filters.length === 0) {
    return signal.slice();
  }

  const calc = new fili.CalcCascades();
  const iirCoeffs = new fili.IirCoeffs();
  let current: number[] | Float32Array = signal;

  for (const spec of filters) {
    if (!spec.enabled) continue;
    if (!isValidFilter(spec, sampleRateHz)) continue;

    let coeffs: FiliCoeffs[];
    try {
      switch (spec.type) {
        case 'pt1':
          // 1st-order Butterworth — equivalent to Betaflight's PT1.
          coeffs = calc.lowpass({
            order: 1,
            characteristic: 'butterworth',
            Fs: sampleRateHz,
            Fc: spec.cutoffHz,
          });
          break;
        case 'biquad': {
          // 2nd-order LPF with user-provided Q. We bypass CalcCascades because
          // its Butterworth path computes its own Q and ignores ours.
          const section = iirCoeffs.lowpass({
            Fs: sampleRateHz,
            Fc: spec.cutoffHz,
            Q: spec.q,
          });
          coeffs = [section];
          break;
        }
        case 'notch': {
          // Bandwidth in Hz → Q = center / bandwidth_hz. Same bypass reason as biquad.
          const q = spec.cutoffHz / Math.max(0.1, spec.bandwidth);
          const section = iirCoeffs.bandstop({
            Fs: sampleRateHz,
            Fc: spec.cutoffHz,
            Q: q,
          });
          coeffs = [section];
          break;
        }
      }
    } catch {
      continue; // skip filters fili couldn't compute coefficients for
    }

    const filter = new fili.IirFilter(coeffs);
    current = filter.multiStep(current);
  }

  // Materialize as Float32Array.
  if (current instanceof Float32Array) return current.slice();
  const out = new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) out[i] = current[i]!;
  return out;
}

function isValidFilter(spec: FilterSpec, sampleRateHz: number): boolean {
  if (!Number.isFinite(spec.cutoffHz)) return false;
  if (spec.cutoffHz <= 0) return false;
  if (spec.cutoffHz >= sampleRateHz / 2) return false;
  if (spec.type === 'biquad' && (!Number.isFinite(spec.q) || spec.q <= 0)) return false;
  if (spec.type === 'notch') {
    if (!Number.isFinite(spec.bandwidth) || spec.bandwidth <= 0) return false;
    if (spec.bandwidth >= sampleRateHz / 2) return false;
  }
  return true;
}

let _counter = 0;
export function newFilterId(): string {
  _counter = (_counter + 1) % 1_000_000;
  return `f${Date.now().toString(36)}-${_counter}`;
}

/* ------------------------------------------------------------------ */
/* Filter chain frequency response (for the Bode plot).                */
/* ------------------------------------------------------------------ */

export interface FilterResponseResult {
  frequencies: Float32Array;
  /** |H(f)| in dB. */
  magnitudeDb: Float32Array;
  /** Group delay in ms (numerical derivative of phase). */
  groupDelayMs: Float32Array;
  /** Whether at least one filter was active when computing this response. */
  hasFilters: boolean;
}

/**
 * Evaluate the cumulative frequency response of an enabled filter chain at
 * each frequency in `frequencies`. Returns |H| in dB and group delay in ms.
 *
 * Group delay is approximated by a forward finite difference on the unwrapped
 * phase. The last bin reuses the previous bin's value since there's no point
 * after it to difference against.
 */
export function computeFilterChainResponse(
  filters: ReadonlyArray<FilterSpec>,
  sampleRateHz: number,
  frequencies: Float32Array,
): FilterResponseResult {
  const sections = buildFilterSections(filters, sampleRateHz);
  const N = frequencies.length;
  const magDb = new Float32Array(N);
  const phase = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const w = (2 * Math.PI * frequencies[i]!) / sampleRateHz;
    let mag = 1;
    let ph = 0;
    for (const sec of sections) {
      const [m, p] = biquadResponse(sec, w);
      mag *= m;
      ph += p;
    }
    magDb[i] = 20 * Math.log10(Math.max(1e-12, mag));
    phase[i] = ph;
  }

  unwrapPhase(phase);

  const groupDelayMs = new Float32Array(N);
  for (let i = 0; i < N - 1; i++) {
    const df = frequencies[i + 1]! - frequencies[i]!;
    if (df > 0) {
      const dPhase = phase[i + 1]! - phase[i]!;
      groupDelayMs[i] = ((-dPhase) / (2 * Math.PI * df)) * 1000;
    }
  }
  groupDelayMs[N - 1] = N >= 2 ? groupDelayMs[N - 2]! : 0;

  return {
    frequencies,
    magnitudeDb: magDb,
    groupDelayMs,
    hasFilters: sections.length > 0,
  };
}

/** Build all biquad sections for the enabled filters. */
function buildFilterSections(
  filters: ReadonlyArray<FilterSpec>,
  sampleRateHz: number,
): FiliCoeffs[] {
  const calc = new fili.CalcCascades();
  const iirCoeffs = new fili.IirCoeffs();
  const out: FiliCoeffs[] = [];

  for (const spec of filters) {
    if (!spec.enabled) continue;
    if (!isValidFilter(spec, sampleRateHz)) continue;

    try {
      switch (spec.type) {
        case 'pt1':
          out.push(
            ...calc.lowpass({
              order: 1,
              characteristic: 'butterworth',
              Fs: sampleRateHz,
              Fc: spec.cutoffHz,
            }),
          );
          break;
        case 'biquad':
          out.push(iirCoeffs.lowpass({ Fs: sampleRateHz, Fc: spec.cutoffHz, Q: spec.q }));
          break;
        case 'notch': {
          const q = spec.cutoffHz / Math.max(0.1, spec.bandwidth);
          out.push(iirCoeffs.bandstop({ Fs: sampleRateHz, Fc: spec.cutoffHz, Q: q }));
          break;
        }
      }
    } catch {
      // skip filters that couldn't be built
    }
  }

  return out;
}

/** |H(e^(jw))| and arg(H) for one biquad section (normalized so a0 = 1). */
function biquadResponse(sec: FiliCoeffs, w: number): [number, number] {
  const b0 = sec.b[0] ?? 0;
  const b1 = sec.b[1] ?? 0;
  const b2 = sec.b[2] ?? 0;
  const a1 = sec.a[0] ?? 0;
  const a2 = sec.a[1] ?? 0;

  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  // Numerator: b0 + b1·e^(-jw) + b2·e^(-2jw)
  const bRe = b0 + b1 * cosW + b2 * cos2W;
  const bIm = -b1 * sinW - b2 * sin2W;

  // Denominator: 1 + a1·e^(-jw) + a2·e^(-2jw)
  const aRe = 1 + a1 * cosW + a2 * cos2W;
  const aIm = -a1 * sinW - a2 * sin2W;

  // H = B / A
  const aMagSq = aRe * aRe + aIm * aIm;
  if (aMagSq === 0) return [0, 0];
  const hRe = (bRe * aRe + bIm * aIm) / aMagSq;
  const hIm = (bIm * aRe - bRe * aIm) / aMagSq;

  return [Math.sqrt(hRe * hRe + hIm * hIm), Math.atan2(hIm, hRe)];
}

/** In-place phase unwrap — eliminate 2π jumps between consecutive samples. */
function unwrapPhase(phase: Float32Array): void {
  for (let i = 1; i < phase.length; i++) {
    const diff = phase[i]! - phase[i - 1]!;
    if (diff > Math.PI) {
      for (let j = i; j < phase.length; j++) phase[j] = phase[j]! - 2 * Math.PI;
    } else if (diff < -Math.PI) {
      for (let j = i; j < phase.length; j++) phase[j] = phase[j]! + 2 * Math.PI;
    }
  }
}
