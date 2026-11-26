import { logState } from './state';

export function newSlotId(): string {
  logState.slotCounter = (logState.slotCounter + 1) % 1_000_000;
  return `s${Date.now().toString(36)}-${logState.slotCounter}`;
}
