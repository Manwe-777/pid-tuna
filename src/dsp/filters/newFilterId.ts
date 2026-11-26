import { dspState } from './state';

export function newFilterId(): string {
  dspState.filterIdCounter = (dspState.filterIdCounter + 1) % 1_000_000;
  return `f${Date.now().toString(36)}-${dspState.filterIdCounter}`;
}
