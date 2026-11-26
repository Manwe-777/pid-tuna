import { ALL_AXIS } from '../constants';
import { computeErrorSetpointDensity } from '../dsp/computeErrorSetpointDensity';
import { latencyForLog } from '../dsp/latencyForLog';
import { stepResponseMask } from '../dsp/step/stepResponseMask';
import type { ErrorSetpointResult, ParsedLog } from '../types';

/**
 * Error-vs-setpoint density in flight (always filtered gyro), optionally with
 * gyro shifted back by the measured latency. "All" pools every axis' samples.
 */
export function errorSetpointForAxis(log: ParsedLog, axis: number, compensateLag: boolean): ErrorSetpointResult {
  const mask = stepResponseMask(log, { flightOnly: true });
  const input = (a: number) => ({
    setpoint: log.setpoint[a]!,
    gyro: log.gyroFilt[a]!,
    mask,
    lagSamples: compensateLag ? (latencyForLog(log, a).lagMs / 1000) * log.setup.sampleRateHz : 0,
  });

  return computeErrorSetpointDensity(axis === ALL_AXIS ? [0, 1, 2].map(input) : input(axis));
}
