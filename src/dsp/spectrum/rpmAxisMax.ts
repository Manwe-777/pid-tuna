/** Robust upper bound for the RPM axis: the 99.5th percentile, rounded up to a
 *  tidy step, so a few telemetry spikes don't stretch the whole scale. */
export function rpmAxisMax(rpm: Float32Array): number {
  const positive = Array.from(rpm).filter((v) => v > 0);
  if (positive.length === 0) return 1;
  positive.sort((a, b) => a - b);
  const p = positive[Math.min(positive.length - 1, Math.floor(positive.length * 0.995))]!;
  const step = 5000;
  return Math.max(step, Math.ceil(p / step) * step);
}
