import type { BalanceAnalysis, MotorPsd, MotorStats, ParsedLog } from '../../types';
import { flightRange } from '../flightRange';
import { computePsd } from '../spectrum/computePsd';
import { throttlePercentSeries } from '../throttlePercentSeries';
import { analyzeImbalance } from './analyzeImbalance';

/**
 * Per-motor balance + noise analysis. Projects per-motor means onto the
 * pitch/roll/yaw axes (for 4-motor frames) and surfaces any single-motor outlier
 * — both signed, so the user can interpret direction against their own motor
 * mapping. Also computes a PSD of each motor command so per-motor oscillations
 * show up as spikes.
 */
export function analyzeMotorBalance(log: ParsedLog, options: { psdWindow?: number } = {}): BalanceAnalysis {
  const sampleRate = log.setup.sampleRateHz;
  const psdWindow = options.psdWindow ?? 1024;
  const range = flightRange(throttlePercentSeries(log), sampleRate) ?? { start: 0, end: log.time.length - 1 };
  const cut = (a: Float32Array) => a.subarray(range.start, range.end + 1);
  const zero = motorZero(log);
  const motors = log.motor.map(cut);
  const yawReversed = log.setup.rawHeaders.yaw_motors_reversed === '1';

  const stats: MotorStats[] = motors.map((m, i) => {
    const { mean: rawMean, std } = meanStd(m);
    const mean = rawMean - zero;
    const eRpm = log.eRpm[i] ? cut(log.eRpm[i]!) : undefined;
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

  const { axes, dominantAxis, singleMotorOutlier } = analyzeImbalance(stats, yawReversed);

  const motorPsds: MotorPsd[] = motors.map((m) => {
    const { frequencies, psdDb } = computePsd(m, sampleRate, { windowSize: psdWindow });
    return { frequencies, psdDb };
  });

  return { motors: stats, axes, dominantAxis, singleMotorOutlier, motorPsds };
}

/** The motor command that means zero output: the low end of `motorOutput`. */
function motorZero(log: ParsedLog): number {
  const low = Number.parseFloat((log.setup.rawHeaders.motorOutput ?? '').split(',')[0] ?? '');

  return Number.isFinite(low) ? low : 0;
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
