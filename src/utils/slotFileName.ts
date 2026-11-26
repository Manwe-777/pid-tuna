import { flightLabel } from '../logs/flightLabel';
import type { SlotState } from '../types';

/** The log's file name (with its flight number in multi-flight files), whether parsing, ready or failed. */
export function slotFileName(state: SlotState): string {
  return state.kind === 'ready'
    ? flightLabel(state.log.fileName, state.log.logIndex, state.log.logCount)
    : state.fileName;
}
