import { MOTOR_COLORS } from '../../constants';
import type { BalanceAnalysis } from '../../types';

export function BalanceStatsTable({ analysis }: { analysis: BalanceAnalysis }) {
  const { motors, singleMotorOutlier } = analysis;
  const outlierMotor = singleMotorOutlier?.motorIndex ?? null;
  const maxLoad = Math.max(...motors.map((m) => m.relativeLoad), 1);
  return (
    <table className="diff-table balance-table">
      <thead>
        <tr>
          <th>Motor</th>
          <th title="Mean motor command above zero output, takeoff to landing">Mean output</th>
          <th>Load</th>
          <th title="How much the command moves around its mean">Output σ</th>
          <th>Mean eRPM</th>
          <th>eRPM CV</th>
        </tr>
      </thead>
      <tbody>
        {motors.map((m) => {
          const color = MOTOR_COLORS[m.motorIndex % MOTOR_COLORS.length]!;
          const flagged = m.motorIndex === outlierMotor;
          return (
            <tr key={m.motorIndex} className={flagged ? 'balance-row--outlier' : undefined}>
              <th>
                <span className="balance-chip" style={{ background: color }}>
                  M{m.motorIndex + 1}
                </span>
              </th>
              <td>{m.pwmMean.toFixed(0)}</td>
              <td>
                <div className="balance-bar">
                  <div
                    className="balance-bar__fill"
                    style={{
                      width: `${(m.relativeLoad / maxLoad) * 100}%`,
                      background: flagged ? '#ff7070' : color,
                    }}
                  />
                  <span className="balance-bar__label">{m.relativeLoad.toFixed(1)}%</span>
                </div>
              </td>
              <td>{m.pwmStd.toFixed(1)}</td>
              <td>{m.meanERpm != null ? m.meanERpm.toFixed(0) : <span className="muted">—</span>}</td>
              <td>{m.erpmCv != null ? `${(m.erpmCv * 100).toFixed(1)}%` : <span className="muted">—</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
