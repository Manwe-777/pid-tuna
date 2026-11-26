import { TABS } from '../../constants';
import type { TabId } from '../../types';

export function TabBar({
  active,
  onChange,
  disabled,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  disabled: ReadonlySet<TabId>;
}) {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => {
        const isDisabled = disabled.has(t.id);
        const cls = [
          'tab-bar__tab',
          active === t.id ? 'tab-bar__tab--active' : '',
          isDisabled ? 'tab-bar__tab--empty' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={t.id}
            type="button"
            className={cls}
            onClick={() => !isDisabled && onChange(t.id)}
            disabled={isDisabled}
            title={isDisabled ? 'No data in the loaded log(s) for this tab' : undefined}
          >
            {t.label}
            {isDisabled && <span className="tab-bar__dot" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}
