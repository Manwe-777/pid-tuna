/**
 * Desktop self-update pill. Only does anything inside the Tauri app: on startup
 * it asks GitHub Releases (via the updater plugin) whether a newer signed build
 * exists and, if so, offers a one-click download-install-relaunch.
 *
 * Everything is best-effort and silent on failure — in the browser/PWA build,
 * during `tauri:dev`, when the build isn't signed, or when offline, `check()`
 * throws or returns null and this renders nothing. The web/PWA build updates
 * itself through its service worker instead.
 *
 * The plugin modules are imported dynamically so the web bundle never pulls in
 * Tauri internals.
 */

import { useEffect, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '../msp/port';

type Phase = 'idle' | 'downloading' | 'error';

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check();
        if (!cancelled && found) setUpdate(found);
      } catch {
        // No release yet / unsigned build / offline / dev — stay quiet.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const install = async () => {
    setPhase('downloading');
    setPct(0);
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0;
        else if (e.event === 'Progress') {
          received += e.data.chunkLength;
          if (total > 0) setPct(Math.min(100, Math.round((received / total) * 100)));
        }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setPhase('error');
    }
  };

  const label =
    phase === 'downloading'
      ? `Updating… ${pct}%`
      : phase === 'error'
        ? 'Update failed — retry'
        : `Update to v${update.version}`;

  return (
    <button
      type="button"
      className="update-pill"
      onClick={install}
      disabled={phase === 'downloading'}
      title={`A new version (v${update.version}) is available`}
    >
      <span className="update-pill__dot" />
      {label}
    </button>
  );
}
