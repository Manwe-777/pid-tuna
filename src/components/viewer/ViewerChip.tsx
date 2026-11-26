/** A checkbox chip with a colour swatch. */
export function ViewerChip({
  label,
  color,
  checked,
  disabled = false,
  tip,
  onToggle,
}: {
  label: string;
  color?: string;
  checked: boolean;
  disabled?: boolean;
  tip?: string;
  onToggle: () => void;
}) {
  return (
    <label data-tip={tip}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      {color && <span className="signal-chip__swatch" style={{ background: color }} />}
      {label}
    </label>
  );
}
