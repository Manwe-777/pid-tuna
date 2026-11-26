/** Centre frequency of each FFT bin, Hz. */
export function binFrequencies(freqBins: number, sampleRateHz: number, fftSize: number): Float32Array {
  const frequencies = new Float32Array(freqBins);
  const fStep = sampleRateHz / fftSize;
  for (let f = 0; f < freqBins; f++) frequencies[f] = f * fStep;

  return frequencies;
}
