export function normalizeHeadingDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}
