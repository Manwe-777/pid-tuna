import type { LogSlot } from '../types';
import { flightLabel } from './flightLabel';

export function shortName(slot: LogSlot): string {
  if (slot.state.kind !== 'ready') return slot.id.slice(0, 6);
  const { fileName, logIndex, logCount } = slot.state.log;

  return flightLabel(fileName.replace(/\.(bbl|bfl|csv)$/i, ''), logIndex, logCount);
}
