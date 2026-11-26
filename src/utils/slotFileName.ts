import type { SlotState } from '../types';

/** The log's file name, whether it is still parsing, ready or failed. */
export function slotFileName(state: SlotState): string {
  return state.kind === 'ready' ? state.log.fileName : state.fileName;
}
