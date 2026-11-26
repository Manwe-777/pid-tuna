import { mulberry32 } from './mulberry32';

export interface StickOptions {
  seconds: number;
  sampleRateHz: number;
  /** Max |setpoint| in deg/s. */
  amplitude: number;
  /** Hold time range for each stick position, ms. */
  holdMs: [number, number];
  /** RC smoothing cutoff applied to the steps, Hz. */
  smoothingHz: number;
  seed: number;
}

/** Piecewise-constant stick moves smoothed by a PT1, like a pilot's rate setpoint after RC smoothing. */
export function stickSetpoint(opts: StickOptions): Float32Array {
  const rand = mulberry32(opts.seed);
  const n = Math.round(opts.seconds * opts.sampleRateHz);
  const out = new Float32Array(n);
  const k = 1 - Math.exp((-2 * Math.PI * opts.smoothingHz) / opts.sampleRateHz);
  let target = 0;
  let holdLeft = 0;
  let y = 0;

  for (let i = 0; i < n; i++) {
    if (holdLeft <= 0) {
      target = rand() < 0.3 ? 0 : (rand() * 2 - 1) * opts.amplitude;
      const [lo, hi] = opts.holdMs;
      holdLeft = Math.round(((lo + rand() * (hi - lo)) / 1000) * opts.sampleRateHz);
    }

    holdLeft--;
    y += k * (target - y);
    out[i] = y;
  }

  return out;
}
