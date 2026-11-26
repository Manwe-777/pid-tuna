export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;

  return p;
}
