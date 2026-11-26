import { AXIS_COLORS, AXIS_NAMES, NOISE_BANDS } from '../../constants';
import type { LogSlot } from '../../types';
import { meanInBand } from '../../utils/meanInBand';
import { ComparedNumber } from './ComparedNumber';
import { DiffBlockHeader } from './DiffBlockHeader';

export function NoiseDiffBlock({
  current,
  prev,
}: {
  current: { slot: LogSlot; axes: Array<{ frequencies: Float32Array; psdDb: Float32Array }> };
  prev: { slot: LogSlot; axes: Array<{ frequencies: Float32Array; psdDb: Float32Array }> } | null;
}) {
  return (
    <div className="diff-log">
      <DiffBlockHeader slot={current.slot} log={null} prev={prev?.slot ?? null} />
      <table className="diff-table">
        <thead>
          <tr>
            <th></th>
            {NOISE_BANDS.map((b) => (
              <th key={b.label}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AXIS_NAMES.map((name, axis) => {
            const c = current.axes[axis]!;
            const p = prev?.axes[axis] ?? null;
            return (
              <tr key={name}>
                <th>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[axis] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
                {NOISE_BANDS.map((b) => {
                  const cv = meanInBand(c.frequencies, c.psdDb, b.lo, b.hi);
                  const pv = p ? meanInBand(p.frequencies, p.psdDb, b.lo, b.hi) : null;
                  return (
                    <td key={b.label}>
                      <ComparedNumber
                        value={Number.isFinite(cv) ? cv : null}
                        prev={pv != null && Number.isFinite(pv) ? pv : null}
                        unit="dB"
                        dim={!prev}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
