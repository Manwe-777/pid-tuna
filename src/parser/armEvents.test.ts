import { describe, expect, test } from 'vitest';

import { armEvents } from './armEvents';

describe('armEvents', () => {
  test('a log that starts armed and ends disarmed has one arm and one disarm', () => {
    expect(armEvents([0, 30, 132.98], [1, 1, 0])).toEqual([
      { time: 0, kind: 'arm' },
      { time: 132.98, kind: 'disarm' },
    ]);
  });

  test('other mode bits switching on and off are not arm events', () => {
    // Bit 6 toggles (a mode switch) while ARM stays on; bit 20 (air mode) stays on after disarm.
    expect(armEvents([0, 22, 33, 46, 159], [1 | 64, 1, 1 | 64, 1 | (1 << 20), 1 << 20])).toEqual([
      { time: 0, kind: 'arm' },
      { time: 159, kind: 'disarm' },
    ]);
  });

  test('a log that starts disarmed gets its arm event when the switch goes on', () => {
    expect(armEvents([0, 5, 60], [0, 1, 0]).map((e) => [e.time, e.kind])).toEqual([
      [5, 'arm'],
      [60, 'disarm'],
    ]);
  });

  test('re-arming mid-log gives a disarm then an arm', () => {
    expect(armEvents([0, 10, 12], [1, 0, 1]).map((e) => e.kind)).toEqual(['arm', 'disarm', 'arm']);
  });

  test('frames without flags are skipped, and nothing at all gives no events', () => {
    expect(armEvents([0, 1, 2], [NaN, 1, NaN])).toEqual([{ time: 1, kind: 'arm' }]);
    expect(armEvents([], [])).toEqual([]);
  });

  test('a slow frame logged before the first main frame lands at time 0, not before', () => {
    expect(armEvents([-3.2], [1])).toEqual([{ time: 0, kind: 'arm' }]);
  });
});
