import '../compat';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseLog } from '../parser';
import type { StepMetrics } from './stepResponse';
import { stepResponseForLog } from './stepResponseForLog';

/**
 * One tuning session on one quad (`$PIDTUNA_LOG_DIR/pid/LOG000NN.BFL`), with the
 * changes between flights read from the log headers. Roll only: pitch has too
 * few usable windows in these flights.
 */
const DIR = join(process.env.PIDTUNA_LOG_DIR ?? '', 'pid');
const available = Boolean(process.env.PIDTUNA_LOG_DIR) && existsSync(join(DIR, 'LOG00009.BFL'));
const cache = new Map<number, Promise<StepMetrics>>();

function roll(flight: number): Promise<StepMetrics> {
  if (!cache.has(flight)) {
    const file = `LOG${String(flight).padStart(5, '0')}.BFL`;
    cache.set(flight, parseLog(new File([readFileSync(join(DIR, file))], file)).then((log) => stepResponseForLog(log, 0).metrics));
  }

  return cache.get(flight)!;
}

describe.skipIf(!available)('tuning session: step response follows the tune changes', () => {
  test('raising D (flight 4 → 5) cuts overshoot by more than 5 points', async () => {
    expect((await roll(5)).overshootPct!).toBeLessThan((await roll(4)).overshootPct! - 5);
  });

  test('lowering P twice (flights 6 → 7 → 8) slows the rise each time and narrows the bandwidth', async () => {
    const [a, b, c] = await Promise.all([roll(6), roll(7), roll(8)]);
    expect(b.riseTimeMs!).toBeGreaterThan(a.riseTimeMs!);
    expect(c.riseTimeMs!).toBeGreaterThan(b.riseTimeMs!);
    expect(c.bandwidthHz!).toBeLessThan(a.bandwidthHz!);
  });

  test('raising P again (flight 8 → 9) speeds the rise back up', async () => {
    expect((await roll(9)).riseTimeMs!).toBeLessThan((await roll(8)).riseTimeMs! - 2);
  });

  test('two flights on the same tune (5 and 6) agree within 5 ms of rise and 3 points of overshoot', async () => {
    const [a, b] = await Promise.all([roll(5), roll(6)]);
    expect(Math.abs(a.riseTimeMs! - b.riseTimeMs!)).toBeLessThan(5);
    expect(Math.abs(a.overshootPct! - b.overshootPct!)).toBeLessThan(3);
  });
});
