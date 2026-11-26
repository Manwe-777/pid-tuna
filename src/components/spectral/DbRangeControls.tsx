/** Min/max dB of the PSD colour scale, with "Auto" to drop the overrides. */
export function DbRangeControls(p: {
  floorDb: number;
  ceilDb: number;
  overridden: boolean;
  onMin: (db: number) => void;
  onMax: (db: number) => void;
  onAuto: () => void;
}) {
  return (
    <>
      <label>
        Min dB:
        <input
          type="number"
          step={5}
          value={p.floorDb}
          onChange={(e) => p.onMin(Number.parseInt(e.target.value, 10))}
          className="spec-db-input"
        />
      </label>
      <label>
        Max dB:
        <input
          type="number"
          step={5}
          value={p.ceilDb}
          onChange={(e) => p.onMax(Number.parseInt(e.target.value, 10))}
          className="spec-db-input"
        />
      </label>
      {p.overridden && (
        <button type="button" className="btn btn--sm" onClick={p.onAuto}>
          Auto
        </button>
      )}
    </>
  );
}
