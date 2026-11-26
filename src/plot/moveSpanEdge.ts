import type { TimeSpan } from '../types';

/**
 * The span with one edge moved to `value`, kept inside `bounds`. An edge stops just short
 * of the other one, so the span never empties or turns inside out.
 */
export function moveSpanEdge(span: TimeSpan, edge: 'min' | 'max', value: number, bounds: TimeSpan): TimeSpan {
  const gap = (bounds.max - bounds.min) / 1000;
  const v = Math.min(bounds.max, Math.max(bounds.min, value));
  if (edge === 'min') return { min: Math.min(v, span.max - gap), max: span.max };

  return { min: span.min, max: Math.max(v, span.min + gap) };
}
