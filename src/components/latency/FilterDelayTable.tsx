import type { FilterDelayEntry } from '../../types';

export function FilterDelayTable({ entries }: { entries: FilterDelayEntry[] }) {
  return (
    <table className="diff-table">
      <thead>
        <tr>
          <th>Filter</th>
          <th>Path</th>
          <th>Cutoff / centre</th>
          <th>Type</th>
          <th>Delay</th>
          <th>Lag</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={`${e.label}-${i}`}>
            <th>{e.label}</th>
            <td className="muted">{e.chain === 'gyro' ? 'gyro' : 'D only'}</td>
            <td data-tip={e.note}>
              {e.cutoffHz > 0 ? `${e.cutoffHz} Hz` : '—'}
              {e.dynamic && <span className="muted"> (dyn)</span>}
            </td>
            <td className="muted">{e.type}</td>
            <td>{e.delayMs >= 0.005 ? `${e.delayMs.toFixed(2)} ms` : <span className="muted">~0</span>}</td>
            <td className="muted">{e.delayMs >= 0.005 ? `${(-e.phaseDeg).toFixed(1)}°` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
