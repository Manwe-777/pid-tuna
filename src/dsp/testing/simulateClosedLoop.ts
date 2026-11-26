export interface ClosedLoopPlant {
  /** Natural frequency of the closed loop, Hz. */
  naturalHz: number;
  damping: number;
  /** Pure dead time, in output samples. */
  delaySamples: number;
  /** Steady-state gain (1 = perfect tracking). */
  gain?: number;
}

const SUBSTEPS = 16;

/** Second-order closed loop with dead time, integrated with substeps for accuracy. */
export function simulateClosedLoop(
  input: ArrayLike<number>,
  sampleRateHz: number,
  plant: ClosedLoopPlant,
): Float32Array {
  const wn = 2 * Math.PI * plant.naturalHz;
  const zeta = plant.damping;
  const gain = plant.gain ?? 1;
  const dt = 1 / sampleRateHz / SUBSTEPS;
  const out = new Float32Array(input.length);
  let y = 0;
  let v = 0;

  for (let n = 0; n < input.length; n++) {
    const src = n - plant.delaySamples;
    const u = src >= 0 ? input[src]! * gain : 0;

    for (let s = 0; s < SUBSTEPS; s++) {
      const a = wn * wn * (u - y) - 2 * zeta * wn * v;
      v += a * dt;
      y += v * dt;
    }

    out[n] = y;
  }

  return out;
}
