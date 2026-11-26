import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type ActiveTooltip, useTooltip } from '../../hooks/useTooltip';
import type { TooltipPlacement } from '../../types';
import { tooltipPlacement } from '../../utils/tooltipPlacement';

const TOOLTIP_ID = 'app-tooltip';

/**
 * The app's one tooltip. Any element with a `data-tip` attribute gets it on
 * hover or keyboard focus; mount this once at the root.
 */
export function TooltipLayer() {
  const active = useTooltip();
  const ref = useRef<HTMLDivElement>(null);
  // The placement remembers which tooltip it was measured for, so a new one is
  // measured off-screen before it is shown.
  const [placed, setPlaced] = useState<{ tip: ActiveTooltip; placement: TooltipPlacement } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;

    const { anchor } = active;
    const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
    const placement = tooltipPlacement(anchor.getBoundingClientRect(), el.getBoundingClientRect(), viewport);
    setPlaced({ tip: active, placement });
    anchor.setAttribute('aria-describedby', TOOLTIP_ID);

    return () => anchor.removeAttribute('aria-describedby');
  }, [active]);

  if (!active) return null;

  const placement = placed?.tip === active ? placed.placement : null;
  const style = placement
    ? ({ left: placement.left, top: placement.top, '--arrow-x': `${placement.arrowX}px` } as CSSProperties)
    : undefined;

  return createPortal(
    <div
      ref={ref}
      id={TOOLTIP_ID}
      role="tooltip"
      className={`tooltip ${placement ? `tooltip--${placement.side}` : 'tooltip--measuring'}`}
      style={style}
    >
      {active.text}
    </div>,
    document.body,
  );
}
