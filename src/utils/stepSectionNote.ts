import { shortName } from '../logs/shortName';
import type { LogEntry, StepSettings } from '../types';

/** The sentence before the Step response description saying what the curves are: bands, pooled logs or one per log. */
export function stepSectionNote(
  splitBy: StepSettings['splitBy'],
  entries: LogEntry[],
  merged: boolean,
  multi: boolean,
): string {
  if (splitBy !== 'none') {
    if (!entries[0]) return '';
    const by = splitBy === 'stick' ? 'average stick input per window' : 'stick throttle';

    return `Bands from ${shortName(entries[0].slot)}, by ${by}. `;
  }

  if (merged) return `Pooling windows from ${entries.length} logs into one estimate. `;

  return multi ? 'Each log uses its own dash pattern. ' : '';
}
