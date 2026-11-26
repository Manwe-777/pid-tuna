import { useCallback, useEffect, useRef, useState } from 'react';

import { COPIED_FEEDBACK_MS } from '../constants';

/**
 * Copies text to the clipboard and remembers which item was copied for a
 * moment, so its button can say "Copied". A failed write (no permission,
 * insecure page) reports `failed` for that item instead.
 */
export function useCopyText() {
  const [status, setStatus] = useState<{ key: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (key: string, text: string) => {
    let ok = true;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }

    setStatus({ key, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), COPIED_FEEDBACK_MS);
  }, []);

  return {
    copy,
    copied: (key: string) => status?.key === key && status.ok,
    failed: (key: string) => status?.key === key && !status.ok,
  };
}
