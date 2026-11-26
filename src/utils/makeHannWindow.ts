export function makeHannWindow(n: number): Float64Array {
  const out = new Float64Array(n);
  if (n < 2) {
    if (n === 1) out[0] = 1;

    return out;
  }

  for (let i = 0; i < n; i++) out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));

  return out;
}
