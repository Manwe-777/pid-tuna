import type { ParsedLog } from '../types';

export interface StepMaskOptions {
  /** Samples below this throttle (0–100) are unusable: on the ground, idling, landing. */
  minThrottle?: number;
  /** Samples where any motor sits at its lowest or highest output are unusable. */
  excludeSaturation?: boolean;
}

/** Fraction of the motor range treated as pinned at either end. */
const SATURATION_MARGIN = 0.01;

/**
 * Per-sample usability for step-response analysis: 1 where the drone is flying
 * and the mixer has headroom, 0 where gyro can't follow setpoint for reasons
 * that have nothing to do with the tune.
 */
export function stepResponseMask(log: ParsedLog, opts: StepMaskOptions): Uint8Array {
  const n = log.time.length;
  const mask = new Uint8Array(n).fill(1);
  const minThrottle = opts.minThrottle ?? 0;
  const throttle = log.setpoint[3];

  if (minThrottle > 0 && throttle) {
    for (let i = 0; i < n; i++) if (!(throttle[i]! >= minThrottle)) mask[i] = 0;
  }

  const range = motorRange(log);
  if (!opts.excludeSaturation || !range || log.motor.length === 0) return mask;

  const margin = (range.max - range.min) * SATURATION_MARGIN;
  const lo = range.min + margin;
  const hi = range.max - margin;

  for (const motor of log.motor) {
    for (let i = 0; i < n; i++) {
      const v = motor[i]!;
      if (v <= lo || v >= hi) mask[i] = 0;
    }
  }

  return mask;
}

function motorRange(log: ParsedLog): { min: number; max: number } | null {
  const raw = log.setup.rawHeaders.motorOutput;
  if (!raw) return null;

  const [min, max] = raw.split(',').map((v) => Number.parseFloat(v));
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max! > min!)) return null;

  return { min: min!, max: max! };
}
