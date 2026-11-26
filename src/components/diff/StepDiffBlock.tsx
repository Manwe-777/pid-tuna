import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import type { LogSlot } from '../../types';
import { computeAxisSteps } from '../../utils/computeAxisSteps';
import { ComparedNumber } from './ComparedNumber';
import { DiffBlockHeader } from './DiffBlockHeader';

export function StepDiffBlock({
  current,
  prev,
}: {
  current: { slot: LogSlot; axes: ReturnType<typeof computeAxisSteps> };
  prev: { slot: LogSlot; axes: ReturnType<typeof computeAxisSteps> } | null;
}) {
  return (
    <div className="diff-log">
      <DiffBlockHeader slot={current.slot} log={null} prev={prev?.slot ?? null} />
      <table className="diff-table">
        <tbody>
          {AXIS_NAMES.map((name, i) => {
            const c = current.axes[i]!.metrics;
            const p = prev?.axes[i]!.metrics ?? null;
            return (
              <tr key={name}>
                <th>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
                <td className="diff-table__metrics">
                  <ComparedNumber
                    value={c.riseTimeMs}
                    prev={p?.riseTimeMs ?? null}
                    unit="ms"
                    label="rise"
                    dim={!prev}
                  />
                  <ComparedNumber
                    value={c.overshootPct}
                    prev={p?.overshootPct ?? null}
                    unit="%"
                    label="over"
                    dim={!prev}
                  />
                  <ComparedNumber
                    value={c.settlingTimeMs}
                    prev={p?.settlingTimeMs ?? null}
                    unit="ms"
                    label="settle"
                    dim={!prev}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
