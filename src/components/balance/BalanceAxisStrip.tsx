import type { AxisImbalance } from '../../types';

export function BalanceAxisStrip({
  axes,
  dominantAxis,
  singleOutlier,
}: {
  axes: AxisImbalance[];
  dominantAxis: AxisImbalance['axis'] | null;
  singleOutlier: { motorIndex: number; deltaPct: number } | null;
}) {
  if (axes.length === 0 && singleOutlier == null) {
    return <span className="balance-tag balance-tag--ok">balanced</span>;
  }
  return (
    <span className="balance-axis-strip">
      {axes.map((a) => {
        const isDominant = a.axis === dominantAxis;
        const sign = a.deltaPct >= 0 ? '+' : '';
        return (
          <span key={a.axis} className={`balance-axis${isDominant ? ' balance-axis--dom' : ''}`}>
            <span className="balance-axis__label">{a.axis}</span>
            <span className="balance-axis__value">
              {sign}
              {a.deltaPct.toFixed(1)}%
            </span>
          </span>
        );
      })}
      {singleOutlier && (
        <span className="balance-tag balance-tag--warn">
          M{singleOutlier.motorIndex + 1} outlier · {singleOutlier.deltaPct >= 0 ? '+' : ''}
          {singleOutlier.deltaPct.toFixed(1)}%
        </span>
      )}
    </span>
  );
}
