/** Mean of `psdDb` between [fLo, fHi]. Returns NaN if no bins fall in range. */
export function meanInBand(frequencies: Float32Array, psdDb: Float32Array, fLo: number, fHi: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i]!;
    if (f < fLo || f >= fHi) continue;
    sum += psdDb[i]!;
    n++;
  }
  return n > 0 ? sum / n : Number.NaN;
}
