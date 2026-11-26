import type { ParsedLog } from '../types';
import { parseLogStartMs } from './parseLogStartMs';

export function formatLogStartLabel(log: ParsedLog): string | null {
  const ms = parseLogStartMs(log);
  if (ms == null) return null;
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
