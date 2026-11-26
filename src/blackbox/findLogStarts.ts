import { BB_LOG_START } from '../constants';

const MARKER = Uint8Array.from(BB_LOG_START, (c) => c.charCodeAt(0));

/** Where each log in a blackbox file starts; a file holds one log per arming. */
export function findLogStarts(data: Uint8Array): number[] {
  const starts: number[] = [];
  const first = MARKER[0]!;

  for (let i = data.indexOf(first); i >= 0 && i <= data.length - MARKER.length; i = data.indexOf(first, i + 1)) {
    if (matchesAt(data, i)) starts.push(i);
  }

  return starts;
}

function matchesAt(data: Uint8Array, at: number): boolean {
  for (let j = 1; j < MARKER.length; j++) if (data[at + j] !== MARKER[j]) return false;

  return true;
}
