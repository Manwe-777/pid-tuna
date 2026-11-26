import { AXIS_NAMES } from '../constants';
import type { AxisSaturation, ItermLimitSource, ParsedLog, SaturationAnalysis, SaturationRun } from '../types';
import { flightRange } from './flightRange';
import { throttlePercentSeries } from './throttlePercentSeries';

const SATURATION_FACTOR = 0.95;

const DEFAULT_ITERM_LIMIT = 400;

/**
 * I-term saturation per axis, takeoff to landing. The limit follows Betaflight:
 * from 2025 it is iterm_windup % × pidsum_limit (pidsum_limit_yaw on yaw);
 * before that it is iterm_limit, which the log header doesn't carry, so the
 * default 400 is assumed unless a header provides it.
 */
export function analyzeSaturation(log: ParsedLog): SaturationAnalysis {
  const { limits, source } = itermLimits(log);
  const range = flightRange(throttlePercentSeries(log), log.setup.sampleRateHz) ?? {
    start: 0,
    end: log.time.length - 1,
  };

  const axes: AxisSaturation[] = AXIS_NAMES.map((name, i) => {
    const iTerm = log.iTerm[i]!;
    const time = log.time;
    const limit = limits[i]!;
    const threshold = limit * SATURATION_FACTOR;
    let satCount = 0;
    let sumAbs = 0;
    let peakAbs = 0;
    const runs: SaturationRun[] = [];
    let runStart = -1;
    const end = Math.min(range.end, iTerm.length - 1);

    for (let j = range.start; j <= end; j++) {
      const v = Math.abs(iTerm[j]!);
      sumAbs += v;
      if (v > peakAbs) peakAbs = v;
      if (v >= threshold) {
        satCount++;
        if (runStart < 0) runStart = j;
      } else if (runStart >= 0) {
        runs.push({ t0: time[runStart]!, t1: time[j - 1]! });
        runStart = -1;
      }
    }
    if (runStart >= 0) runs.push({ t0: time[runStart]!, t1: time[end]! });

    const n = Math.max(0, end - range.start + 1);

    return {
      axisIndex: i,
      axisName: name,
      limit,
      threshold,
      meanAbs: n > 0 ? sumAbs / n : 0,
      peakAbs,
      fraction: n > 0 ? satCount / n : 0,
      runs,
      longestRunSec: runs.reduce((m, r) => Math.max(m, r.t1 - r.t0), 0),
    };
  });

  return { itermLimit: limits[0]!, limitSource: source, thresholdUsed: limits[0]! * SATURATION_FACTOR, axes };
}

function itermLimits(log: ParsedLog): { limits: [number, number, number]; source: ItermLimitSource } {
  const h = log.setup.rawHeaders;
  const num = (k: string) => {
    const n = Number.parseFloat(h[k] ?? '');
    return Number.isFinite(n) ? n : null;
  };
  const major = Number.parseInt(log.setup.firmwareVersion ?? '', 10);
  const windup = num('iterm_windup');
  const sum = num('pidsum_limit');
  const sumYaw = num('pidsum_limit_yaw');

  if (major >= 2025 && windup != null && sum != null) {
    const rp = (windup / 100) * sum;

    return { limits: [rp, rp, (windup / 100) * (sumYaw ?? sum)], source: 'windup' };
  }

  const header = num('iterm_limit') ?? num('itermLimit');
  const limit = header ?? DEFAULT_ITERM_LIMIT;

  return { limits: [limit, limit, limit], source: header != null ? 'header' : 'default' };
}
