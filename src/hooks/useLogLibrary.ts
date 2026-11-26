import { useCallback, useState } from 'react';

import { flightLabel } from '../logs/flightLabel';
import { LogLibrary } from '../logs/LogLibrary';
import { newSlotId } from '../logs/newSlotId';
import { parseLog } from '../parser/parseLog';

type Update = (change: (lib: LogLibrary) => void) => void;

/** Parses one flight of a file into a new slot; returns how many flights the file holds (0 on failure). */
async function loadFlight(update: Update, file: File, logIndex: number, name: string): Promise<number> {
  const id = newSlotId();
  update((lib) => lib.add(id, name));

  try {
    const log = await parseLog(file, {
      logIndex,
      onProgress: ({ progress, rows }) => update((lib) => lib.setProgress(id, name, progress, rows)),
    });
    update((lib) => lib.setReady(id, log));

    return log.logCount;
  } catch (err) {
    update((lib) => lib.setError(id, name, err instanceof Error ? err.message : String(err)));

    return 0;
  }
}

/**
 * The loaded logs plus the actions the sidebar needs. Parsing runs in the
 * background; every flight in a file becomes its own log, one after another.
 */
export function useLogLibrary() {
  const [library, setLibrary] = useState(() => new LogLibrary());

  const update = useCallback<Update>((change) => {
    setLibrary((prev) => {
      const next = prev.clone();
      change(next);

      return next;
    });
  }, []);

  const addFile = useCallback(
    async (file: File) => {
      const count = await loadFlight(update, file, 0, file.name);
      for (let i = 1; i < count; i++) await loadFlight(update, file, i, flightLabel(file.name, i, count));
    },
    [update],
  );

  const toggle = useCallback((id: string) => update((lib) => lib.toggle(id)), [update]);
  const remove = useCallback((id: string) => update((lib) => lib.remove(id)), [update]);
  const reorder = useCallback((fromId: string, toId: string) => update((lib) => lib.reorder(fromId, toId)), [update]);

  return { library, addFile, toggle, remove, reorder };
}
