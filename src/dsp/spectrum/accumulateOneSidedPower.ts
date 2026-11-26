/**
 * Add one FFT's one-sided power spectrum, `|X|² · psdNorm`, to `accum`.
 * Bin 0 and Nyquist are counted once, all others doubled.
 */
export function accumulateOneSidedPower(
  accum: Float64Array,
  fftOut: Float64Array,
  psdNorm: number,
  nyquistBin: number,
): void {
  for (let f = 0; f < accum.length; f++) {
    const re = fftOut[2 * f]!;
    const im = fftOut[2 * f + 1]!;
    const power = (re * re + im * im) * psdNorm;
    // One-sided: bin 0 and Nyquist counted once, all others doubled.
    const factor = f === 0 || f === nyquistBin ? 1 : 2;
    accum[f] = accum[f]! + power * factor;
  }
}
