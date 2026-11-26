import { describe, expect, test } from 'vitest';

import type { LogEntry, ParsedLog } from '../types';
import { plotEvents } from './plotEvents';

function entry(fileName: string, events: ParsedLog['events']): Pick<LogEntry, 'log' | 'slot'> {
  const log = { fileName, logIndex: 0, logCount: 1, events } as unknown as ParsedLog;

  return { log, slot: { id: fileName, state: { kind: 'ready', log } } as unknown as LogEntry['slot'] };
}

describe('plotEvents', () => {
  test('one log: labels say what happened and when', () => {
    const events = plotEvents([entry('LOG1.BFL', [{ time: 132.981, kind: 'disarm' }])]);
    expect(events).toEqual([{ time: 132.981, kind: 'disarm', label: 'Disarmed at 132.98 s' }]);
  });

  test('several logs: each label names its log', () => {
    const labels = plotEvents([
      entry('LOG1.BFL', [{ time: 0, kind: 'arm' }]),
      entry('LOG5.BFL', [{ time: 0, kind: 'arm' }]),
    ]).map((e) => e.label);
    expect(labels).toEqual(['Armed at 0.00 s · LOG1', 'Armed at 0.00 s · LOG5']);
  });

  test('a plot with its own time axis moves the event but the label keeps log time', () => {
    const [e] = plotEvents([entry('LOG1.BFL', [{ time: 60, kind: 'disarm' }])], (t) => t - 5);
    expect(e?.time).toBe(55);
    expect(e?.label).toBe('Disarmed at 60.00 s');
  });
});
