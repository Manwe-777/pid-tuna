import { SIGNAL_DEFS } from '../constants';
import type { ParsedLog, SignalKey } from '../types';
import { extractSignal } from './extractSignal';

/** Which signals the log actually carries; all-zero arrays (e.g. unlogged gyroUnfilt) count as missing. */
export function signalAvailability(log: ParsedLog): Record<SignalKey, boolean> {
  const out = {} as Record<SignalKey, boolean>;

  for (const def of SIGNAL_DEFS) {
    const sample = extractSignal(log, def.key, 0);
    out[def.key] = !!sample && sample.length > 0 && sample.some((v) => v !== 0);
  }

  return out;
}
