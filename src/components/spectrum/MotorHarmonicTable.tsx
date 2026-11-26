import type { AxisHarmonicNoise } from '../../types';
import { AxisRows } from './AxisRows';

/**
 * Noise left at each multiple of motor speed, per axis: filtered gyro,
 * unfiltered gyro, and how many dB the filtering removes there.
 */
export function MotorHarmonicTable({ axes }: { axes: AxisHarmonicNoise[] }) {
  const harmonics = axes[0]?.filtered.length ?? 0;

  return (
    <table className="diff-table harmonic-table">
      <thead>
        <tr>
          <th>Axis</th>
          <th>Signal</th>
          {Array.from({ length: harmonics }, (_, h) => (
            <th key={h}>{h + 1}× motor</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {axes.map((a, axis) => (
          <AxisRows key={axis} axis={axis} data={a} />
        ))}
      </tbody>
    </table>
  );
}
