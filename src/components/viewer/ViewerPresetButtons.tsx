import { VIEWER_PRESETS } from '../../constants';
import type { ViewerPreset, ViewerPresetId } from '../../types';

/** One button per preset; the one matching the current signals is pressed. */
export function ViewerPresetButtons({
  active,
  onPick,
}: {
  active: ViewerPresetId | null;
  onPick: (preset: ViewerPreset) => void;
}) {
  return (
    <>
      {VIEWER_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="btn btn--sm btn--choice"
          aria-pressed={active === p.id}
          data-tip={p.hint}
          onClick={() => onPick(p)}
        >
          {p.label}
        </button>
      ))}
    </>
  );
}
