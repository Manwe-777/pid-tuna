/** m:ss.s from seconds (negative reads 0:00.0). */
export function formatPlaybackClock(secFromStart: number): string {
  const s = Math.max(0, secFromStart);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const rs = r < 10 ? `0${r.toFixed(1)}` : r.toFixed(1);

  return `${m}:${rs}`;
}
