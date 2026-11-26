import type { LogEvent } from '../types';

/** Bit of the slow frames' `flightModeFlags` set while the ARM switch is on. */
const ARM_BIT = 1;

/**
 * Arming and disarming from the slow frames' mode flags: one event wherever
 * the ARM bit changes, plus an arm event when the log starts armed, which is
 * how Betaflight starts logging. Frames without flags are skipped.
 */
export function armEvents(times: ArrayLike<number>, modeFlags: ArrayLike<number>): LogEvent[] {
  const events: LogEvent[] = [];
  let armed: boolean | null = null;

  for (let i = 0; i < Math.min(times.length, modeFlags.length); i++) {
    const flags = modeFlags[i]!;
    if (!Number.isFinite(flags)) continue;

    const now = (flags & ARM_BIT) !== 0;
    const changed = armed === null ? now : now !== armed;
    if (changed) events.push({ time: Math.max(0, times[i]!), kind: now ? 'arm' : 'disarm' });
    armed = now;
  }

  return events;
}
