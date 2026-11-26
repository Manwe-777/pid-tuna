import { useEffect, useState } from 'react';

import { TOOLTIP_DELAY_MS, TOOLTIP_WARM_MS } from '../constants';

export interface ActiveTooltip {
  text: string;
  anchor: Element;
}

const SELECTOR = '[data-tip]';

function tipAnchor(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(SELECTOR) : null;
}

/**
 * Tracks which `data-tip` element the pointer or keyboard focus is on. The
 * first tooltip waits a short hover; moving straight on to another tipped
 * element shows its tooltip at once. Pressing, scrolling or Escape hides it.
 */
export function useTooltip(): ActiveTooltip | null {
  const [active, setActive] = useState<ActiveTooltip | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    let shown = false;
    let hiddenAt = Number.NEGATIVE_INFINITY;

    const show = (anchor: Element) => {
      const text = anchor.getAttribute('data-tip');
      if (!text) return;

      shown = true;
      setActive({ text, anchor });
    };

    // `keepAnchor` hides the tooltip without forgetting the element, so it
    // stays hidden until the pointer moves to another one.
    const hide = (keepAnchor = false) => {
      clearTimeout(timer);
      if (shown) hiddenAt = Date.now();
      if (!keepAnchor) current = null;
      shown = false;
      setActive(null);
    };

    const dismiss = () => hide(true);

    const enter = (anchor: Element | null, immediate: boolean) => {
      if (anchor === current) return;

      const warm = shown || Date.now() - hiddenAt < TOOLTIP_WARM_MS;
      hide();
      if (!anchor) return;

      current = anchor;
      if (immediate || warm) show(anchor);
      else timer = setTimeout(() => show(anchor), TOOLTIP_DELAY_MS);
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      enter(tipAnchor(e.target), false);
    };

    const onPointerLeaveWindow = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };

    const onFocusOut = () => hide();

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.matches(':focus-visible')) enter(tipAnchor(el), true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerLeaveWindow);
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerLeaveWindow);
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, []);

  return active;
}
