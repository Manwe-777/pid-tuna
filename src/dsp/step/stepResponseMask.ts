import type { ParsedLog, StepMaskOptions } from '../../types';
import { flightRange } from '../flightRange';
import { throttlePercentSeries } from '../throttlePercentSeries';

/** Fraction of the motor range treated as pinned at either end. */
const SATURATION_MARGIN = 0.01;

/**
 * Per-sample usability for analyses that compare setpoint and gyro: 1 where
 * the drone is flying (and, if asked, within a throttle band with mixer
 * headroom), 0 where gyro can't follow setpoint for reasons unrelated to the tune.
 */
export function stepResponseMask(log: ParsedLog, opts: StepMaskOptions): Uint8Array {
  const n = log.time.length;
  const mask = new Uint8Array(n).fill(1);
  const throttle = throttlePercentSeries(log);

  if (opts.flightOnly) maskOutsideFlight(mask, throttle, log.setup.sampleRateHz);
  maskOutsideThrottleBand(mask, throttle, opts.minThrottle ?? 0, opts.maxThrottle ?? Infinity);
  if (opts.excludeSaturation) maskSaturatedMotors(mask, log);

  return mask;
}

function maskOutsideFlight(mask: Uint8Array, throttle: Float32Array, sampleRateHz: number): void {
  const range = flightRange(throttle, sampleRateHz);
  if (!range) return;

  mask.fill(0, 0, range.start);
  mask.fill(0, range.end + 1);
}

function maskOutsideThrottleBand(
  mask: Uint8Array,
  throttle: Float32Array,
  minThrottle: number,
  maxThrottle: number,
): void {
  if (!(minThrottle > 0 || maxThrottle < Infinity)) return;

  for (let i = 0; i < mask.length; i++) {
    const t = throttle[i]!;
    if (!(t >= minThrottle && t <= maxThrottle)) mask[i] = 0;
  }
}

/** Zero samples where any motor is pinned within SATURATION_MARGIN of either end of its range. */
function maskSaturatedMotors(mask: Uint8Array, log: ParsedLog): void {
  const range = motorRange(log);
  if (!range || log.motor.length === 0) return;

  const margin = (range.max - range.min) * SATURATION_MARGIN;
  const lo = range.min + margin;
  const hi = range.max - margin;

  for (const motor of log.motor) {
    for (let i = 0; i < mask.length; i++) {
      const v = motor[i]!;
      if (v <= lo || v >= hi) mask[i] = 0;
    }
  }
}

function motorRange(log: ParsedLog): { min: number; max: number } | null {
  const raw = log.setup.rawHeaders.motorOutput;
  if (!raw) return null;

  const [min, max] = raw.split(',').map((v) => Number.parseFloat(v));
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max! > min!)) return null;

  return { min: min!, max: max! };
}
