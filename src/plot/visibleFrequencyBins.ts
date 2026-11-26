/** Last frequency bin to show (cropped to `maxFreqHz`, else Nyquist) and the frequency it sits at. */
export function visibleFrequencyBins(
  frequencies: Float32Array,
  freqBins: number,
  maxFreqHz: number | undefined,
): { maxBin: number; displayedFMax: number } {
  const nyquist = frequencies[frequencies.length - 1] ?? 0;
  const fMax = maxFreqHz != null ? Math.min(maxFreqHz, nyquist) : nyquist;
  const fStep = frequencies.length > 1 ? frequencies[1]! - frequencies[0]! : 0;
  const maxBin = fStep > 0 ? Math.min(freqBins - 1, Math.round(fMax / fStep)) : freqBins - 1;

  return { maxBin, displayedFMax: frequencies[maxBin] ?? fMax };
}
