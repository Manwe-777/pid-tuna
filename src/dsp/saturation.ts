import { AXIS_NAMES } from '../axes';
import type { ParsedLog } from '../types';

export interface SaturationRun {
  /** Time of first saturated sample (s). */
  t0: number;
  /** Time of last saturated sample (s). */
  t1: number;
}

export interface AxisSaturation {
  axisIndex: number;
  axisName: string;
  /** Saturation threshold used (in same units as iTerm). */
  threshold: number;
  /** Mean |iTerm| over the window, useful for context. */
  meanAbs: number;
  /** Peak |iTerm| over the window. */
  peakAbs: number;
  /** Fraction of samples at or above the threshold, in [0, 1]. */
  fraction: number;
  /** Distinct saturation runs (each is a continuous span). */
  runs: SaturationRun[];
  /** Longest run duration in seconds. */
  longestRunSec: number;
}

export interface SaturationAnalysis {
  /** The configured I-term limit pulled from headers (or null if not present). */
  itermLimit: number | null;
  /** Threshold used to count "saturation" (typically 0.95 × limit). */
  thresholdUsed: number | null;
  axes: AxisSaturation[];
}

const SATURATION_FACTOR = 0.95;
const DEFAULT_ITERM_LIMIT = 400; // Betaflight default

/**
 * Detect I-term saturation per axis. "Saturated" = |iTerm| ≥ thresholdUsed,
 * where thresholdUsed defaults to 95% of the firmware-configured limit. If no
 * limit header is found, we use the Betaflight default of 400 — flag this in
 * the UI so the user knows the value isn't authoritative.
 */
export function analyzeSaturation(log: ParsedLog): SaturationAnalysis {
  const h = log.setup.rawHeaders;
  const limitRaw = numFromHeader(h, ['iterm_limit', 'itermLimit', 'i_term_limit']);
  const limit = limitRaw ?? DEFAULT_ITERM_LIMIT;
  const threshold = limit * SATURATION_FACTOR;

  const axes: AxisSaturation[] = AXIS_NAMES.map((name, i) => {
    const iTerm = log.iTerm[i]!;
    const time = log.time;
    let satCount = 0;
    let sumAbs = 0;
    let peakAbs = 0;
    const runs: SaturationRun[] = [];
    let runStart = -1;

    for (let j = 0; j < iTerm.length; j++) {
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
    if (runStart >= 0) {
      runs.push({ t0: time[runStart]!, t1: time[iTerm.length - 1]! });
    }

    const longestRunSec = runs.reduce((m, r) => Math.max(m, r.t1 - r.t0), 0);
    const fraction = iTerm.length > 0 ? satCount / iTerm.length : 0;
    const meanAbs = iTerm.length > 0 ? sumAbs / iTerm.length : 0;

    return {
      axisIndex: i,
      axisName: name,
      threshold,
      meanAbs,
      peakAbs,
      fraction,
      runs,
      longestRunSec,
    };
  });

  return {
    itermLimit: limitRaw,
    thresholdUsed: threshold,
    axes,
  };
}

function numFromHeader(h: Readonly<Record<string, string>>, keys: string[]): number | null {
  for (const k of keys) {
    const v = h[k];
    if (v == null) continue;
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
