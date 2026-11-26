import type { BalanceAnalysis, ScoreEntry, ScoreStatus } from '../../types';

export function balanceEntry(balance: BalanceAnalysis): ScoreEntry | null {
  if (balance.axes.length > 0) {
    const worst = Math.max(...balance.axes.map((a) => Math.abs(a.deltaPct)));
    const status: ScoreStatus = worst < 2 ? 'good' : worst < 6 ? 'warn' : 'bad';
    return {
      key: 'Motor balance',
      status,
      value: balance.axes.map((a) => `${a.axis} ${a.deltaPct >= 0 ? '+' : ''}${a.deltaPct.toFixed(1)}%`).join(' · '),
      detail:
        balance.singleMotorOutlier != null
          ? `M${balance.singleMotorOutlier.motorIndex + 1} outlier (${balance.singleMotorOutlier.deltaPct.toFixed(1)}%)`
          : balance.dominantAxis != null
            ? `${balance.dominantAxis} is the dominant imbalance axis`
            : 'No dominant axis',
    };
  }
  if (balance.singleMotorOutlier != null) {
    return {
      key: 'Motor balance',
      status: 'warn',
      value: `M${balance.singleMotorOutlier.motorIndex + 1} outlier`,
      detail: `${balance.singleMotorOutlier.deltaPct.toFixed(1)}% from neighbors`,
    };
  }
  return null;
}
