import { LOG_COLORS } from '../constants';
import type { LogSlot } from '../types';

export function colorFor(slot: LogSlot): string {
  return LOG_COLORS[slot.dashIndex % LOG_COLORS.length]!;
}
