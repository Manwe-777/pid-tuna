import type { TuneItem } from '../../types';

/** Label/value lines, skipping items without a value. */
export function TuneValueList({ items }: { items: TuneItem[] }) {
  return (
    <ul className="tune-list">
      {items
        .filter(([, v]) => v != null)
        .map(([k, v]) => (
          <li key={k}>
            <span className="tune-list__k">{k}</span>
            <span className="tune-list__v">{v}</span>
          </li>
        ))}
    </ul>
  );
}
