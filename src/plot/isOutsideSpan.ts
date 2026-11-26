import type { TimeSpan } from '../types';

/** Whether `value` falls outside the span; a click there clears the selection. */
export function isOutsideSpan(span: TimeSpan | null, value: number): boolean {
  return span != null && (value < span.min || value > span.max);
}
