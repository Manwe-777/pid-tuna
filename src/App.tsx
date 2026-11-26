import { useMemo } from 'react';

import { TooltipLayer } from './components/common/TooltipLayer';
import { Analyses } from './components/layout/Analyses';
import { FcMscButton } from './components/layout/FcMscButton';
import { Sidebar } from './components/layout/Sidebar';
import { ThemeToggle } from './components/layout/ThemeToggle';
import { useLogLibrary } from './hooks/useLogLibrary';

export function App() {
  const { library, addFile, toggle, remove, reorder } = useLogLibrary();
  const enabled = useMemo(() => library.enabled, [library]);

  return (
    <>
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}pidtuna-wordmark.svg`} alt="PIDTuna" className="app-header__logo" />
        <div className="app-header__right">
          <ThemeToggle />
          <FcMscButton />
          <a
            className="app-header__version"
            href={`https://github.com/Manwe-777/pid-tuna/releases/tag/v${__APP_VERSION__}`}
            target="_blank"
            rel="noreferrer noopener"
            data-tip="View this version's release notes"
          >
            v{__APP_VERSION__}
          </a>
        </div>
      </header>
      <div className="app-shell">
        <Sidebar slots={library.slots} onAddFile={addFile} onToggle={toggle} onRemove={remove} onReorder={reorder} />
        <main className="app">
          {enabled.length > 0 ? (
            <Analyses enabled={enabled} />
          ) : (
            <p className="muted">
              Load a log in the sidebar and enable it to begin. Loaded logs can be toggled on/off to compare them.
            </p>
          )}
        </main>
      </div>
      <TooltipLayer />
    </>
  );
}
