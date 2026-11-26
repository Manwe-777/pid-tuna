import type { BalanceAnalysis, MotorPsd, MotorStats } from '../../types';
import { analyzeImbalance } from './analyzeImbalance';

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

      if (m.meanERpm != null) {
        erpmSum += m.meanERpm;
        erpmCount++;
      }

      if (m.erpmCv != null) {
        erpmCvSum += m.erpmCv;
        erpmCvCount++;
      }
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
