import type { GpsSample } from '../../types';

/** Linear interpolate lat/lon at time `t` along GPS fixes. */
export function interpolateGps(samples: GpsSample[], t: number): [number, number] | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return [samples[0]!.lat, samples[0]!.lon];
  if (t <= samples[0]!.t) return [samples[0]!.lat, samples[0]!.lon];
  const last = samples[samples.length - 1]!;
  if (t >= last.t) return [last.lat, last.lon];

  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo]!;
  const b = samples[hi]!;
  const u = (t - a.t) / (b.t - a.t);
  return [a.lat + (b.lat - a.lat) * u, a.lon + (b.lon - a.lon) * u];
}
