import type { LogSlot } from '../types';

export function shortName(slot: LogSlot): string {
  if (slot.state.kind !== 'ready') return slot.id.slice(0, 6);
  return slot.state.log.fileName.replace(/\.(bbl|bfl|csv)$/i, '');
}
