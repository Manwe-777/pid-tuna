import type { Biquad, ChainResponse } from '../../types';

/** Frequency response of cascaded sections at one frequency. */
export function biquadChainResponse(sections: readonly Biquad[], hz: number, loopHz: number): ChainResponse {
  const w = (2 * Math.PI * hz) / loopHz;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  let magnitude = 1;
  let phase = 0;

  for (const s of sections) {
    const nRe = s.b0 + s.b1 * c1 + s.b2 * c2;
    const nIm = -s.b1 * s1 - s.b2 * s2;
    const dRe = 1 + s.a1 * c1 + s.a2 * c2;
    const dIm = -s.a1 * s1 - s.a2 * s2;
    magnitude *= Math.hypot(nRe, nIm) / Math.hypot(dRe, dIm);
    phase += Math.atan2(nIm, nRe) - Math.atan2(dIm, dRe);
  }

  return { magnitude, phase };
}
