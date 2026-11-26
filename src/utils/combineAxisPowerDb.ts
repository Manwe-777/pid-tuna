import type { SpectralValueMode } from '../types';

/**
 * Combine per-axis spectra into one "All axes" view. Each input is an absolute
 * PSD-in-dB array; we sum them in the linear power domain (the physically
 * correct way to add uncorrelated noise), then emit either amplitude-relative
 * dB (magnitude mode) or absolute dB (psd mode).
 */
export function combineAxisPowerDb(psdDbArrays: Float32Array[], outMode: SpectralValueMode): Float32Array {
  const n = psdDbArrays[0]?.length ?? 0;
  const acc = new Float64Array(n);
  for (const arr of psdDbArrays) {
    for (let i = 0; i < n; i++) acc[i] = acc[i]! + Math.pow(10, arr[i]! / 10);
  }
  const out = new Float32Array(n);
  if (outMode === 'psd') {
    const floor = -200;
    for (let i = 0; i < n; i++) {
      const d = acc[i]! > 0 ? 10 * Math.log10(acc[i]!) : floor;
      out[i] = d < floor ? floor : d;
    }
  } else {
    let peak = 0;
    for (let i = 0; i < n; i++) if (acc[i]! > peak) peak = acc[i]!;
    const floor = -80;
    const inv = peak > 0 ? 1 / peak : 0;
    for (let i = 0; i < n; i++) {
      const r = acc[i]! * inv;
      const d = r > 0 ? 10 * Math.log10(r) : floor;
      out[i] = d < floor ? floor : d;
    }
  }
  return out;
}
