import { Fragment } from 'react';

import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import { shortName } from '../../logs/shortName';
import type { LogSlot, TuneView } from '../../types';
import { formatGain } from '../../utils/formatGain';

interface Props {
  views: Array<{ slot: LogSlot; view: TuneView }>;
  headers: string[];
  columns: (view: TuneView, axis: number) => Array<number | undefined>;
}

/** Per-axis values, one row per log; values that differ from the first log are highlighted. */
export function TuneCompareTable({ views, headers, columns }: Props) {
  const multi = views.length > 1;

  return (
    <table className="tune-table">
      <thead>
        <tr>
          <th></th>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {AXIS_NAMES.map((name, i) => {
          const primaryCols = columns(views[0]!.view, i);

          return (
            <Fragment key={name}>
              {views.map(({ slot, view }, vi) => {
                const isPrimary = vi === 0;

                return (
                  <tr key={slot.id} className={isPrimary ? undefined : 'tune-cmp__row-b'}>
                    {isPrimary && (
                      <th rowSpan={views.length}>
                        <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                          {name.toUpperCase()}
                        </span>
                      </th>
                    )}
                    {multi && <td className="tune-cmp__label">{shortName(slot)}</td>}
                    {columns(view, i).map((v, c) => (
                      <td key={c} className={!isPrimary && v !== primaryCols[c] ? 'tune-cmp__diff' : undefined}>
                        {formatGain(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
