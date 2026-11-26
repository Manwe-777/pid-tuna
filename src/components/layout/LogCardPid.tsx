import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import type { TuneView } from '../../types';
import { formatGain } from '../../utils/formatGain';

/** P · I · D · D-max · F per axis. */
export function LogCardPid({ view }: { view: TuneView }) {
  return (
    <div className="log-card__pid" title="P · I · D · D-max · F">
      {AXIS_NAMES.map((name, i) => {
        const row = view.pidByAxis[i]!;

        return (
          <div key={name} className="log-card__pid-row">
            <span className="log-card__chip" style={{ background: AXIS_COLORS[i] }}>
              {name.slice(0, 1)}
            </span>
            <span className="log-card__num">{formatGain(row.p)}</span>
            <span className="log-card__num">{formatGain(row.i)}</span>
            <span className="log-card__num">{formatGain(row.d)}</span>
            <span className="log-card__num log-card__num--sub">{formatGain(row.dMax)}</span>
            <span className="log-card__num log-card__num--sub">{formatGain(row.f)}</span>
          </div>
        );
      })}
    </div>
  );
}
