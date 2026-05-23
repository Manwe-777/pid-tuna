import type { ParsedLog } from '../types';
import { computePsd } from './spectrogram';

export interface MotorStats {
  motorIndex: number;
  /** Mean of the raw motor command values (PWM µs or DSHOT). */
  pwmMean: number;
  /** Standard deviation of the motor command. Indicates how hard the motor is fighting. */
  pwmStd: number;
  /** Mean throttle as 0-100% of the across-motors max mean (relative balance). */
  relativeLoad: number;
  /** Mean eRPM (×100 to undo Betaflight's eRPM/100 logging). null if not telemetered. */
  meanERpm: number | null;
  /** Coefficient of variation of eRPM (std/mean). Higher = noisier RPM. null if not available. */
  erpmCv: number | null;
}

export interface MotorPsd {
  frequencies: Float32Array;
  psdDb: Float32Array;
}

export type AxisKind = 'pitch' | 'roll' | 'yaw';

/**
 * Signed imbalance on one of the three rigid-body axes. Sign is determined by
 * the default Quad-X mixer coefficients — the user is the one who knows their
 * motor mapping and can interpret the direction.
 *
 * Sign conventions (per Betaflight default mixer):
 *   pitch: (M1 + M3) − (M2 + M4) — positive when M1/M3 pair runs higher
 *   roll:  (M1 + M2) − (M3 + M4) — positive when M1/M2 pair runs higher
 *   yaw:   (M2 + M3) − (M1 + M4) — positive when M2/M3 (CCW in default) pair runs higher
 */
export interface AxisImbalance {
  axis: AxisKind;
  /** Signed delta as a % of the overall mean motor command. */
  deltaPct: number;
}

export interface BalanceAnalysis {
  motors: MotorStats[];
  /** Per-axis imbalance. Empty for non-4-motor frames. */
  axes: AxisImbalance[];
  /** Whichever axis dominates if any exceeds the threshold; null otherwise. */
  dominantAxis: AxisKind | null;
  /** A single motor far from the rest (large gap to next motor). null if no clear outlier. */
  singleMotorOutlier: { motorIndex: number; deltaPct: number } | null;
  /** Per-motor PSD of the motor command signal. */
  motorPsds: MotorPsd[];
}

/**
 * Per-motor balance + noise analysis. Projects per-motor means onto the
 * pitch/roll/yaw axes (for 4-motor frames) and surfaces any single-motor outlier
 * — both signed, so the user can interpret direction against their own motor
 * mapping. Also computes a PSD of each motor command so per-motor oscillations
 * show up as spikes.
 */
export function analyzeMotorBalance(
  log: ParsedLog,
  options: { psdWindow?: number } = {},
): BalanceAnalysis {
  const motors = log.motor;
  const sampleRate = log.setup.sampleRateHz;
  const psdWindow = options.psdWindow ?? 1024;

  const stats: MotorStats[] = motors.map((m, i) => {
    const { mean, std } = meanStd(m);
    const eRpm = log.eRpm[i];
    let meanERpm: number | null = null;
    let erpmCv: number | null = null;
    if (eRpm && eRpm.length > 0) {
      const { mean: em, std: es } = meanStd(eRpm);
      if (em > 0) {
        meanERpm = em * 100; // BF logs eRPM/100
        erpmCv = es / em;
      }
    }
    return {
      motorIndex: i,
      pwmMean: mean,
      pwmStd: std,
      relativeLoad: 0, // backfilled below
      meanERpm,
      erpmCv,
    };
  });

  // Relative load: each motor's pwmMean as % of the max-mean across motors.
  const maxMean = stats.reduce((m, s) => Math.max(m, s.pwmMean), 0);
  if (maxMean > 0) {
    for (const s of stats) s.relativeLoad = (s.pwmMean / maxMean) * 100;
  }

  const { axes, dominantAxis, singleMotorOutlier } = analyzeImbalance(stats);

  const motorPsds: MotorPsd[] = motors.map((m) => {
    const { frequencies, psdDb } = computePsd(m, sampleRate, { windowSize: psdWindow });
    return { frequencies, psdDb };
  });

  return { motors: stats, axes, dominantAxis, singleMotorOutlier, motorPsds };
}

/**
 * Pool balance analyses across multiple logs into one. Per-motor stats
 * (pwmMean / pwmStd / relativeLoad / eRPM) are averaged across logs; the
 * imbalance projection and outlier detection are re-derived from the pooled
 * motor stats so they match single-log semantics. Per-motor PSDs are
 * combined in linear power.
 *
 * Logs whose motor count or PSD bin count differ from the first are skipped
 * — that only happens if you mix logs from different frames or with different
 * looptimes, which can't be averaged meaningfully.
 */
export function combineMotorBalances(analyses: BalanceAnalysis[]): BalanceAnalysis {
  if (analyses.length === 0) {
    return {
      motors: [],
      axes: [],
      dominantAxis: null,
      singleMotorOutlier: null,
      motorPsds: [],
    };
  }
  if (analyses.length === 1) return analyses[0]!;

  const ref = analyses[0]!;
  const motorCount = ref.motors.length;
  const valid = analyses.filter((a) => a.motors.length === motorCount);
  if (valid.length === 0) return ref;

  const motors: MotorStats[] = [];
  for (let i = 0; i < motorCount; i++) {
    let pwmMeanSum = 0;
    let pwmStdSum = 0;
    let relLoadSum = 0;
    let erpmSum = 0;
    let erpmCount = 0;
    let erpmCvSum = 0;
    let erpmCvCount = 0;
    for (const a of valid) {
      const m = a.motors[i]!;
      pwmMeanSum += m.pwmMean;
      pwmStdSum += m.pwmStd;
      relLoadSum += m.relativeLoad;
      if (m.meanERpm != null) { erpmSum += m.meanERpm; erpmCount++; }
      if (m.erpmCv != null) { erpmCvSum += m.erpmCv; erpmCvCount++; }
    }
    motors.push({
      motorIndex: i,
      pwmMean: pwmMeanSum / valid.length,
      pwmStd: pwmStdSum / valid.length,
      relativeLoad: relLoadSum / valid.length,
      meanERpm: erpmCount > 0 ? erpmSum / erpmCount : null,
      erpmCv: erpmCvCount > 0 ? erpmCvSum / erpmCvCount : null,
    });
  }

  const { axes, dominantAxis, singleMotorOutlier } = analyzeImbalance(motors);

  const motorPsds: MotorPsd[] = ref.motorPsds.map((refPsd, mi) => {
    const bins = refPsd.psdDb.length;
    if (bins === 0) return refPsd;
    const accum = new Float64Array(bins);
    let count = 0;
    for (const a of valid) {
      const p = a.motorPsds[mi];
      if (!p || p.psdDb.length !== bins) continue;
      for (let f = 0; f < bins; f++) accum[f] = accum[f]! + Math.pow(10, p.psdDb[f]! / 10);
      count++;
    }
    if (count === 0) return refPsd;
    const inv = 1 / count;
    const psdDb = new Float32Array(bins);
    for (let f = 0; f < bins; f++) {
      const lin = accum[f]! * inv;
      psdDb[f] = lin > 0 ? 10 * Math.log10(lin) : -200;
    }
    return { frequencies: refPsd.frequencies, psdDb };
  });

  return { motors, axes, dominantAxis, singleMotorOutlier, motorPsds };
}

const DOMINANT_THRESHOLD_PCT = 2;
const SINGLE_OUTLIER_THRESHOLD_PCT = 3;

/**
 * Project per-motor means onto the three rigid-body axes (pitch / roll / yaw).
 * The sign conventions follow the default Quad-X mixer; the user knows their
 * own motor mapping and can interpret directionality on their end.
 *
 * For non-4-motor frames we skip axis projection and only attempt single-motor
 * outlier detection.
 */
function analyzeImbalance(motors: MotorStats[]): {
  axes: AxisImbalance[];
  dominantAxis: AxisKind | null;
  singleMotorOutlier: { motorIndex: number; deltaPct: number } | null;
} {
  if (motors.length !== 4) {
    return {
      axes: [],
      dominantAxis: null,
      singleMotorOutlier: detectSingleOutlier(motors),
    };
  }

  const m1 = motors[0]!.pwmMean;
  const m2 = motors[1]!.pwmMean;
  const m3 = motors[2]!.pwmMean;
  const m4 = motors[3]!.pwmMean;
  const overall = (m1 + m2 + m3 + m4) / 4;
  if (overall <= 0) {
    return { axes: [], dominantAxis: null, singleMotorOutlier: null };
  }
  const pct = (delta: number) => (delta / overall) * 100;

  const axes: AxisImbalance[] = [
    { axis: 'pitch', deltaPct: pct((m1 + m3) - (m2 + m4)) / 2 },
    { axis: 'roll',  deltaPct: pct((m1 + m2) - (m3 + m4)) / 2 },
    { axis: 'yaw',   deltaPct: pct((m2 + m3) - (m1 + m4)) / 2 },
  ];

  let dominantAxis: AxisKind | null = null;
  let best = DOMINANT_THRESHOLD_PCT;
  for (const a of axes) {
    if (Math.abs(a.deltaPct) > best) {
      best = Math.abs(a.deltaPct);
      dominantAxis = a.axis;
    }
  }

  return { axes, dominantAxis, singleMotorOutlier: detectSingleOutlier(motors) };
}

function detectSingleOutlier(motors: MotorStats[]): { motorIndex: number; deltaPct: number } | null {
  if (motors.length < 3) return null;
  const overall = motors.reduce((s, m) => s + m.pwmMean, 0) / motors.length;
  if (overall <= 0) return null;
  const sorted = [...motors].sort((a, b) => a.pwmMean - b.pwmMean);
  const topGap = sorted[motors.length - 1]!.pwmMean - sorted[motors.length - 2]!.pwmMean;
  const botGap = sorted[1]!.pwmMean - sorted[0]!.pwmMean;
  const topPct = (topGap / overall) * 100;
  const botPct = (botGap / overall) * 100;
  if (topPct >= botPct && topPct >= SINGLE_OUTLIER_THRESHOLD_PCT) {
    return { motorIndex: sorted[motors.length - 1]!.motorIndex, deltaPct: topPct };
  }
  if (botPct > topPct && botPct >= SINGLE_OUTLIER_THRESHOLD_PCT) {
    return { motorIndex: sorted[0]!.motorIndex, deltaPct: -botPct };
  }
  return null;
}

function meanStd(x: Float32Array): { mean: number; std: number } {
  if (x.length === 0) return { mean: 0, std: 0 };
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]!;
  const mean = sum / x.length;
  let s2 = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i]! - mean;
    s2 += d * d;
  }
  return { mean, std: Math.sqrt(s2 / x.length) };
}

