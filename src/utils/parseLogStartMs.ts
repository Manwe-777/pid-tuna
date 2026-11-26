import type { ParsedLog } from '../types';

/** Read Betaflight `Log start datetime` from raw headers. Returns ms epoch or null. */
export function parseLogStartMs(log: ParsedLog): number | null {
  const h = log.setup.rawHeaders;
  for (const key of ['Log start datetime', 'log_start_datetime']) {
    const v = h[key];
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}
