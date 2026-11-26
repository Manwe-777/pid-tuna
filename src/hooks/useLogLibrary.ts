import { useCallback, useState } from 'react';

import { LogLibrary } from '../logs/LogLibrary';
import { newSlotId } from '../logs/newSlotId';
import { parseLog } from '../parser/parseLog';

/** The loaded logs plus the actions the sidebar needs; parsing runs in the background per file. */
export function useLogLibrary() {
  const [library, setLibrary] = useState(() => new LogLibrary());

  const update = useCallback((change: (lib: LogLibrary) => void) => {
    setLibrary((prev) => {
      const next = prev.clone();
      change(next);

      return next;
    });
  }, []);

  const addFile = useCallback(
    async (file: File) => {
      const id = newSlotId();
      update((lib) => lib.add(id, file.name));
      try {
        const log = await parseLog(file, {
          onProgress: ({ progress, rows }) => update((lib) => lib.setProgress(id, file.name, progress, rows)),
        });
        update((lib) => lib.setReady(id, log));
      } catch (err) {
        update((lib) => lib.setError(id, file.name, err instanceof Error ? err.message : String(err)));
      }
    },
    [update],
  );

  const toggle = useCallback((id: string) => update((lib) => lib.toggle(id)), [update]);
  const remove = useCallback((id: string) => update((lib) => lib.remove(id)), [update]);
  const reorder = useCallback((fromId: string, toId: string) => update((lib) => lib.reorder(fromId, toId)), [update]);

  return { library, addFile, toggle, remove, reorder };
}
