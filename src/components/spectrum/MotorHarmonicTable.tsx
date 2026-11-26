import { AXIS_COLORS, AXIS_NAMES } from '../../axes';
import type { AxisHarmonicNoise } from '../../dsp/harmonicNoiseForLog';
import type { HarmonicNoise } from '../../dsp/motorHarmonicNoise';

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

function AxisRows({ axis, data }: { axis: number; data: AxisHarmonicNoise }) {
  const rows: { label: string; cells: string[]; muted?: boolean }[] = [{ label: 'Gyro', cells: data.filtered.map(level) }];

  if (data.unfiltered) {
    rows.push({ label: 'Unfiltered', cells: data.unfiltered.map(level) });
    rows.push({
      label: 'Removed by filters',
      cells: data.filtered.map((f, i) => removed(data.unfiltered![i], f)),
      muted: true,
    });
  }

  return (
    <>
      {rows.map((row, r) => (
        <tr key={row.label}>
          {r === 0 && (
            <th rowSpan={rows.length}>
              <span className="axis-chip" style={{ background: AXIS_COLORS[axis] }}>
                {AXIS_NAMES[axis]!.toUpperCase()}
              </span>
            </th>
          )}
          <td className={row.muted ? 'muted' : undefined}>{row.label}</td>
          {row.cells.map((c, i) => (
            <td key={i} className={row.muted ? 'muted' : undefined}>
              {c}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function level(h: HarmonicNoise): string {
  return h.meanDb == null ? '—' : `${h.meanDb.toFixed(1)} ± ${h.sdDb!.toFixed(1)} dB`;
}

function removed(raw: HarmonicNoise | undefined, filt: HarmonicNoise): string {
  if (raw?.meanDb == null || filt.meanDb == null) return '—';

  return `${(raw.meanDb - filt.meanDb).toFixed(1)} dB`;
}
