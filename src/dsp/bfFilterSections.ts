/** One second-order section, normalised so a0 = 1: y = b0·x + b1·x₁ + b2·x₂ − a1·y₁ − a2·y₂. */
export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export type BfFilterKind = 'pt1' | 'pt2' | 'pt3' | 'biquad' | 'notch';

export interface BfFilterSpec {
  kind: BfFilterKind;
  /** Cutoff for lowpass filters, centre for notches, Hz. */
  hz: number;
  /** Notch Q (centre / bandwidth). Lowpass biquads use Butterworth Q. */
  q?: number;
}

/** Betaflight's `BIQUAD_Q`. */
const BUTTERWORTH_Q = 1 / Math.SQRT2;

/**
 * Sections that reproduce Betaflight's filter maths (common/filter.c) at a
 * given loop rate:
 * - PT1 is `y += k·(x − y)` with `k = ω/(ω + 1)`, ω = 2π·f·dT.
 * - PT2 and PT3 cascade 2 or 3 PT1 stages, each with its cutoff raised by
 *   1/√(2^(1/n) − 1) so the whole cascade is −3 dB at the set cutoff.
 * - Biquad lowpass and notch use the RBJ cookbook form.
 */
export function bfFilterSections(spec: BfFilterSpec, loopHz: number): Biquad[] {
  if (!(spec.hz > 0) || !(loopHz > 0) || spec.hz >= loopHz / 2) return [];

  const dT = 1 / loopHz;

  switch (spec.kind) {
    case 'pt1':
      return [pt1(spec.hz, dT)];
    case 'pt2':
      return ptn(spec.hz, dT, 2);
    case 'pt3':
      return ptn(spec.hz, dT, 3);
    case 'biquad':
      return [rbj(spec.hz, dT, BUTTERWORTH_Q, 'lowpass')];
    case 'notch':
      return spec.q && spec.q > 0 ? [rbj(spec.hz, dT, spec.q, 'notch')] : [];
  }
}

function pt1(hz: number, dT: number): Biquad {
  const omega = 2 * Math.PI * hz * dT;
  const k = omega / (omega + 1);

  return { b0: k, b1: 0, b2: 0, a1: -(1 - k), a2: 0 };
}

function ptn(hz: number, dT: number, order: number): Biquad[] {
  const correction = 1 / Math.sqrt(2 ** (1 / order) - 1);

  return Array.from({ length: order }, () => pt1(hz * correction, dT));
}

function rbj(hz: number, dT: number, q: number, type: 'lowpass' | 'notch'): Biquad {
  const omega = 2 * Math.PI * hz * dT;
  const sn = Math.sin(omega);
  const cs = Math.cos(omega);
  const alpha = sn / (2 * q);
  const a0 = 1 + alpha;

  if (type === 'lowpass') {
    const b1 = 1 - cs;

    return { b0: b1 / 2 / a0, b1: b1 / a0, b2: b1 / 2 / a0, a1: (-2 * cs) / a0, a2: (1 - alpha) / a0 };
  }

  return { b0: 1 / a0, b1: (-2 * cs) / a0, b2: 1 / a0, a1: (-2 * cs) / a0, a2: (1 - alpha) / a0 };
}
