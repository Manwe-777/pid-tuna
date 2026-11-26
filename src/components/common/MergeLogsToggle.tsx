/**
 * Shared checkbox UI for "Merge logs" toggles. Disabled (with a tooltip) when
 * there's only one log enabled.
 */
export function MergeLogsToggle({
  checked,
  canMerge,
  onChange,
}: {
  checked: boolean;
  canMerge: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        opacity: canMerge ? 1 : 0.45,
        cursor: canMerge ? 'pointer' : 'not-allowed',
      }}
      title={
        canMerge
          ? 'Pool data across every enabled log into one combined view.'
          : 'Enable two or more logs in the sidebar to merge them.'
      }
    >
      <input
        type="checkbox"
        checked={checked && canMerge}
        disabled={!canMerge}
        onChange={(e) => onChange(e.target.checked)}
      />
      Merge logs
    </label>
  );
}
