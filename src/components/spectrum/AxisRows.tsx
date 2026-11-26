import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import type { AxisHarmonicNoise } from '../../types';
import { formatHarmonicLevel } from '../../utils/formatHarmonicLevel';
import { formatHarmonicReduction } from '../../utils/formatHarmonicReduction';

export function AxisRows({ axis, data }: { axis: number; data: AxisHarmonicNoise }) {
  const rows: { label: string; cells: string[]; muted?: boolean }[] = [
    { label: 'Gyro', cells: data.filtered.map(formatHarmonicLevel) },
  ];

  if (data.unfiltered) {
    rows.push({ label: 'Unfiltered', cells: data.unfiltered.map(formatHarmonicLevel) });
    rows.push({
      label: 'Removed by filters',
      cells: data.filtered.map((f, i) => formatHarmonicReduction(data.unfiltered![i], f)),
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
