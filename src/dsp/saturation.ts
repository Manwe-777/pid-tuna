import { AXIS_NAMES } from '../constants';
import type { ParsedLog } from '../types';
import { flightRange } from './flightRange';
import { throttlePercentSeries } from './spectralDomains';

export interface SaturationRun {
  /** Time of first saturated sample (s). */
  t0: number;
  /** Time of last saturated sample (s). */
  t1: number;
}

export interface AxisSaturation {
  axisIndex: number;
  axisName: string;
  /** I-term limit for this axis (same units as the logged I term). */
  limit: number;
  /** Saturation threshold used: 95% of the limit. */
  threshold: number;
  /** Mean |iTerm| in flight, useful for context. */
  meanAbs: number;
  /** Peak |iTerm| in flight. */
  peakAbs: number;
  /** Fraction of in-flight samples at or above the threshold, in [0, 1]. */
  fraction: number;
  /** Distinct saturation runs (each is a continuous span). */
  runs: SaturationRun[];
  /** Longest run duration in seconds. */
  longestRunSec: number;
}

export type ItermLimitSource = 'windup' | 'header' | 'default';

export interface SaturationAnalysis {
  /** Roll/pitch I-term limit. */
  itermLimit: number;
  /** How the limit was found: from iterm_windup × pidsum_limit, an iterm_limit header, or Betaflight's default 400. */
  limitSource: ItermLimitSource;
  /** Threshold used on roll/pitch (95% of the limit). */
  thresholdUsed: number;
  axes: AxisSaturation[];
}

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
