import type { FirmwareInfo } from '../types';

/**
 * Firmware name and version from the `Firmware revision` header, e.g.
 * "Betaflight 2026.6.0-alpha (norevision) STM32F405" or "INAV 7.1.2 (abc) MATEKF405".
 * Old Cleanflight-era logs give their name in `Firmware type` instead.
 */
export function firmwareInfo(lines: ReadonlyMap<string, string>): FirmwareInfo {
  const revision = (lines.get('Firmware revision') ?? '').trim();
  const m = /^([A-Za-z][\w-]*)\s+(\d+)\.(\d+)(?:\.(\d+))?/.exec(revision);

  if (!m) {
    return { kind: lines.get('Firmware type') ?? 'Unknown', version: revision, major: 0, minor: 0, patch: 0 };
  }

  const name = m[1]!;
  const kind = /^inav$/i.test(name) ? 'INAV' : /^emuflight$/i.test(name) ? 'EmuFlight' : name;

  return {
    kind,
    version: revision.slice(name.length).trim(),
    major: Number(m[2]),
    minor: Number(m[3]),
    patch: Number(m[4] ?? 0),
  };
}
