import { TUNE_DIFF_KEYS } from '../../constants';
import type { LogEntry } from '../../types';
import { ComparedTokens } from './ComparedTokens';
import { DiffBlockHeader } from './DiffBlockHeader';

export function TuneDiffBlock({ entry, prev }: { entry: LogEntry; prev: LogEntry | null }) {
  const h = entry.log.setup.rawHeaders;
  const ph = prev?.log.setup.rawHeaders;
  const isBaseline = prev == null;

  const rows = TUNE_DIFF_KEYS.map((key) => ({ key, value: h[key], prev: ph?.[key] })).filter((r) => {
    if (isBaseline) return r.value !== undefined && r.value !== '';
    return (r.value ?? '') !== (r.prev ?? '');
  });

  return (
    <div className="diff-log">
      <DiffBlockHeader slot={entry.slot} log={entry.log} prev={prev?.slot ?? null} />
      {rows.length === 0 ? (
        <p className="muted diff-log__none">{isBaseline ? 'No tune settings logged.' : 'No setting changes.'}</p>
      ) : (
        <table className="diff-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th>{r.key}</th>
                <td>
                  <ComparedTokens value={r.value} prev={r.prev} dim={isBaseline} />
                </td>
                {!isBaseline && <td className="diff-table__was muted">{r.prev ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
