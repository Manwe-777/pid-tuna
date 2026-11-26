import type { Scorecard } from '../types';
import { toCsv } from './toCsv';

/** Every scorecard row of every log: check, status, value and detail. */
export function scorecardCsv(cards: Array<{ label: string; scorecard: Scorecard }>): string {
  const rows = cards.flatMap(({ label, scorecard }) =>
    scorecard.entries.map((e) => [label, e.key, e.status, e.value, e.detail]),
  );

  return toCsv(['log', 'check', 'status', 'value', 'detail'], rows);
}
