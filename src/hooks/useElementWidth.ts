import { type RefObject, useEffect, useState } from 'react';

/** The element's client width, tracked with a ResizeObserver (800 until mounted). */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);

    return () => ro.disconnect();
  }, [ref]);

  return width;
}
