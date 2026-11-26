/**
 * Where log time `t` falls on a time axis that counts samples at the nominal
 * rate (as the spectrogram does): the index of the first sample at or after
 * `t`, divided by the rate. The log's own timestamps can run at a slightly
 * different rate, so the two axes drift apart over a long flight.
 */
export function sampleClockTime(time: Float32Array, sampleRateHz: number, t: number): number {
  let lo = 0;
  let hi = time.length;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (time[mid]! < t) lo = mid + 1;
    else hi = mid;
  }

  return Math.min(lo, Math.max(0, time.length - 1)) / sampleRateHz;
}
