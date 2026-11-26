import { SINGLE_OUTLIER_THRESHOLD_PCT } from '../../constants';
import type { MotorStats } from '../../types';

export function detectSingleOutlier(motors: MotorStats[]): { motorIndex: number; deltaPct: number } | null {
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
