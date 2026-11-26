import { useCallback, useMemo, useState } from 'react';
import { Analyses } from './components/layout/Analyses';
import { FcMscButton } from './components/layout/FcMscButton';
import { Sidebar } from './components/layout/Sidebar';
import { ThemeToggle } from './components/layout/ThemeToggle';
import { enabledLogs } from './logs/enabledLogs';
import { newSlotId } from './logs/newSlotId';
import { parseLog } from './parser/parseLog';
import type { LogSlot } from './types';

export function App() {
  const [slots, setSlots] = useState<LogSlot[]>([]);

  const updateSlot = useCallback((id: string, patch: Partial<LogSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addFile = useCallback(async (file: File) => {
    const id = newSlotId();
    // Assign next dash pattern index — count of existing slots (cycles via DASH_PATTERNS).
    setSlots((prev) => [
      ...prev,
      {
        id,
        enabled: true,
        dashIndex: prev.length,
        state: { kind: 'parsing', fileName: file.name, progress: 0, rows: 0 },
      },
    ]);
    try {
      const log = await parseLog(file, {
        onProgress: ({ progress, rows }) =>
          setSlots((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, state: { kind: 'parsing', fileName: file.name, progress, rows } } : s,
            ),
          ),
      });
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, state: { kind: 'ready', log } } : s)));
    } catch (err) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                state: {
                  kind: 'error',
                  fileName: file.name,
                  message: err instanceof Error ? err.message : String(err),
                },
              }
            : s,
        ),
      );
    }
  }, []);

  const toggleSlot = useCallback((id: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderSlots = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.id === fromId);
      const to = prev.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  void updateSlot;

  const enabled = useMemo(() => enabledLogs(slots), [slots]);

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
            title="View this version's release notes"
          >
            v{__APP_VERSION__}
          </a>
        </div>
      </header>
      <div className="app-shell">
        <Sidebar
          slots={slots}
          onAddFile={addFile}
          onToggle={toggleSlot}
          onRemove={removeSlot}
          onReorder={reorderSlots}
        />
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
    </>
  );
}
