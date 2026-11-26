import type { ParsedLog } from '../../types';

const MAX_NOTCHES = 7;

/**
 * Dynamic-notch centre frequencies in Hz, one series per notch, from
 * debug[1..7] when the log was recorded in FFT_FREQ (or DYN_NOTCH) debug mode.
 * Null in any other mode, since the debug channels then hold something else.
 */
export function dynNotchSeries(log: ParsedLog): Float32Array[] | null {
  const mode = (log.setup.debugMode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (mode !== 'FFTFREQ' && mode !== 'DYNNOTCH') return null;

  const notches: Float32Array[] = [];

  for (let i = 1; i <= MAX_NOTCHES && i < log.debug.length; i++) {
    const ch = log.debug[i]!;
    if (ch.some((v) => v > 0)) notches.push(ch);
  }

  return notches.length > 0 ? notches : null;
}
