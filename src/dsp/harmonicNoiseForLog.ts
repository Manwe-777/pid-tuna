import type { ParsedLog } from '../types';
import { flightRange } from './flightRange';
import { type HarmonicNoise, motorHarmonicNoise } from './motorHarmonicNoise';
import { motorHzSeries } from './motorHzSeries';
import { throttlePercentSeries } from './spectralDomains';

export interface AxisHarmonicNoise {
  filtered: HarmonicNoise[];
  /** Null when the log has no unfiltered gyro. */
  unfiltered: HarmonicNoise[] | null;
}

/** Motor-harmonic noise per axis, takeoff to landing. Null without RPM telemetry. */
export function harmonicNoiseForLog(log: ParsedLog, polePairs?: number, harmonics = 3): AxisHarmonicNoise[] | null {
  const motors = motorHzSeries(log, polePairs);
  if (!motors) return null;

  const fs = log.setup.sampleRateHz;
  const range = flightRange(throttlePercentSeries(log), fs) ?? { start: 0, end: log.time.length - 1 };
  const cut = (a: Float32Array) => a.subarray(range.start, range.end + 1);
  const motorCut = motors.map(cut);
  const hasRaw = log.presence.gyroRaw;

  return [0, 1, 2].map((axis) => ({
    filtered: motorHarmonicNoise(cut(log.gyroFilt[axis]!), motorCut, fs, { harmonics }),
    unfiltered: hasRaw ? motorHarmonicNoise(cut(log.gyroRaw[axis]!), motorCut, fs, { harmonics }) : null,
  }));
}
