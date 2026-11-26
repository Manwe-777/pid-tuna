/** Max-frequency choices up to Nyquist, Nyquist itself last, without duplicates. */
export function maxFreqOptions(nyquist: number): number[] {
  return [250, 500, 750, 1000, nyquist].filter((v, i, a) => v <= nyquist && a.indexOf(v) === i);
}
