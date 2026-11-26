/** Cheap hash of the segment colours (sampled), so the plot rebuilds only when they change. */
export function fingerprintSegmentStrokeColors(seg: readonly string[] | undefined): string {
  if (!seg || seg.length === 0) return '';
  let h = 2166136261 >>> 0;
  const step = Math.max(1, Math.floor(seg.length / 96));

  for (let i = 0; i < seg.length; i += step) {
    const c = seg[i]!;

    for (let k = 0; k < c.length; k++) {
      h = Math.imul(h ^ c.charCodeAt(k), 16777619) >>> 0;
    }
  }

  return `${seg.length}:${h.toString(16)}`;
}
