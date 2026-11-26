import { BF_2025_DEBUG_MODES, BF_DEBUG_MODES_3_3 } from '../constants';
import type { FirmwareInfo } from '../types';

const atLeast = (fw: FirmwareInfo, major: number, minor: number) =>
  fw.major > major || (fw.major === major && fw.minor >= minor);

/** Betaflight 3.3 to 4.5's debug modes for one version, from 3.3's list and the changes since. */
function betaflight4Modes(fw: FirmwareInfo): string[] {
  const modes = [...BF_DEBUG_MODES_3_3];
  const rename = (from: string, to: string) => modes.splice(modes.indexOf(from), 1, to);

  if (atLeast(fw, 3, 4)) {
    rename('GYRO', 'GYRO_FILTERED');
    rename('NOTCH', 'GYRO_SCALED');
  }

  if (atLeast(fw, 4, 0)) modes.splice(modes.indexOf('GYRO_RAW'), 0, 'RX_SFHSS_SPI');

  if (atLeast(fw, 4, 1)) {
    modes.splice(modes.indexOf('DUAL_GYRO'), 1);
    modes.splice(modes.indexOf('DUAL_GYRO_COMBINED'), 1);
  }

  if (atLeast(fw, 4, 3)) {
    rename('FF_INTERPOLATED', 'FEEDFORWARD');
    rename('FF_LIMIT', 'FEEDFORWARD_LIMIT');
  }

  return modes;
}

/** Betaflight's debug mode list for a firmware version, or null when we don't know it. */
function betaflightModes(fw: FirmwareInfo): readonly string[] | null {
  if (fw.major >= 2025) return atLeast(fw, 2026, 6) ? [...BF_2025_DEBUG_MODES, 'AUTOPILOT_PID'] : BF_2025_DEBUG_MODES;
  if (atLeast(fw, 3, 3)) return betaflight4Modes(fw);

  return null;
}

/** The name of a `debug_mode` header value, or "Unknown (n)" when the firmware's list isn't known. */
export function debugModeName(raw: number | null, fw: FirmwareInfo): string {
  if (raw === null) return 'NONE';
  const modes = fw.kind === 'Betaflight' ? betaflightModes(fw) : null;

  return modes?.[raw] ?? `Unknown (${raw})`;
}
