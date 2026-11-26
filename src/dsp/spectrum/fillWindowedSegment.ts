import { segmentMean } from './segmentMean';

/** Write `signal[start ..]` into `buf`, mean removed and multiplied by `window`, over the window's length. */
export function fillWindowedSegment(
  buf: Float64Array,
  signal: Float32Array,
  start: number,
  window: Float64Array,
): void {
  const len = window.length;
  const mean = segmentMean(signal, start, len);
  for (let i = 0; i < len; i++) buf[i] = (signal[start + i]! - mean) * window[i]!;
}
