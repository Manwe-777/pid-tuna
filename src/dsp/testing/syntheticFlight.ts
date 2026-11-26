import { mulberry32 } from './mulberry32';
import { type ClosedLoopPlant, simulateClosedLoop } from './simulateClosedLoop';
import { stickSetpoint } from './stickSetpoint';

export interface SyntheticFlightOptions {
  plant: ClosedLoopPlant;
  sampleRateHz?: number;
  seconds?: number;
  holdMs?: [number, number];
  /** Peak white gyro noise, deg/s. */
  noise?: number;
  /** Amplitude of a 180 Hz motor-noise tone, deg/s. */
  motorTone?: number;
  seed?: number;
}

/** Setpoint and gyro for one axis of a simulated flight with a known closed-loop response. */
export function syntheticFlight(opts: SyntheticFlightOptions): { setpoint: Float32Array; gyro: Float32Array; sampleRateHz: number } {
  const sampleRateHz = opts.sampleRateHz ?? 2000;
  const seed = opts.seed ?? 7;
  const setpoint = stickSetpoint({
    seconds: opts.seconds ?? 60,
    sampleRateHz,
    amplitude: 600,
    holdMs: opts.holdMs ?? [80, 400],
    smoothingHz: 30,
    seed,
  });
  const gyro = simulateClosedLoop(setpoint, sampleRateHz, opts.plant);
  const rand = mulberry32(seed + 1000);
  const noise = opts.noise ?? 25;
  const tone = opts.motorTone ?? 15;

  for (let i = 0; i < gyro.length; i++) {
    gyro[i] = gyro[i]! + (rand() * 2 - 1) * noise + tone * Math.sin((2 * Math.PI * 180 * i) / sampleRateHz);
  }

  return { setpoint, gyro, sampleRateHz };
}
