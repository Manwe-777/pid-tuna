import { DASH_PATTERNS } from '../constants';
import type { LogSlot } from '../types';

export function dashFor(slot: LogSlot): number[] {
  const pattern = DASH_PATTERNS[slot.dashIndex] ?? DASH_PATTERNS[0]!;
  return [...pattern];
}
