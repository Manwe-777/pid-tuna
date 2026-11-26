import { MAX_PARSER_DEBUG_MODE } from '../constants';

/** What one flight's header said before patching. */
export interface OriginalHeader {
  /** The full firmware revision, e.g. "Betaflight 2026.6.0-alpha (norevision) STM32F405"; null if absent. */
  firmwareLine: string | null;
  /** The `debug_mode` value; null if absent or non-numeric. */
  debugMode: number | null;
}

const HEADER_START = 'H Product:';

const FIRMWARE_HEADER_PREFIX = 'H Firmware revision:';

const DEBUG_MODE_HEADER_PREFIX = 'H debug_mode:';

const HEADER_SCAN_BYTES = 16_384;

// The bundled blackbox-log Rust crate (v0.3.1, pinned by blackbox-log-ts 0.2.2)
// accepts Betaflight [4.2.0, 4.5.0) and INAV [5.0.0, 5.2.0) ∪ [6.0.0, 6.1.0).
// 4.4.0 is well inside the BF range. For INAV logs we'd need 5.1.x or 6.0.x.
const PARSER_FRIENDLY_VERSION = '4.4.0';

/**
 * Bundled blackbox-log Rust crate (v0.3.1) accepted ranges:
 *   Betaflight: [4.2.0, 4.5.0)
 *   INAV:       [5.0.0, 5.2.0) ∪ [6.0.0, 6.1.0)
 * Anything else needs patching even if the version string looks otherwise sane.
 */
function isSupportedVersion(firmwareLine: string, major: number, minor: number): boolean {
  if (/^INAV/i.test(firmwareLine)) {
    if (major === 5) return minor >= 0 && minor < 2;
    if (major === 6) return minor === 0;

    return false;
  }

  // Treat Betaflight/EmuFlight/Cleanflight derivatives the same way.
  return major === 4 && minor >= 2 && minor < 5;
}

/** The value after `prefix` on its line within `head`, with its byte offset; null when absent. */
function headerValue(head: string, prefix: string): { value: string; offset: number } | null {
  const prefixIdx = head.indexOf(prefix);
  if (prefixIdx < 0) return null;
  const offset = prefixIdx + prefix.length;
  const lineEnd = head.indexOf('\n', offset);
  if (lineEnd < 0) return null;

  return { value: head.slice(offset, lineEnd).replace(/\r$/, ''), offset };
}

/**
 * Rewrite the firmware version inside the header so the deprecated blackbox-log
 * parser will accept it. Only the version token is touched; the rest of the
 * line (firmware name, board suffix, etc.) is left alone. Length is preserved
 * so all downstream byte offsets remain valid.
 */
function patchFirmwareVersion(out: Uint8Array, head: string, base: number): string | null {
  const line = headerValue(head, FIRMWARE_HEADER_PREFIX);
  if (!line) return null;

  // The first version-shaped token: digits.dots[.-alpha…], e.g. "2026.6.0-alpha".
  const versionMatch = /(\d+(?:\.\d+){1,3})(-[\w.]+)?/.exec(line.value);
  if (!versionMatch) return line.value;

  const [major = 0, minor = 0] = versionMatch[1]!.split('.').map((s) => Number.parseInt(s, 10));
  // Inside one of the parser's accepted ranges: leave it alone. Anything else (year-based
  // majors, prereleases, newer than supported) becomes PARSER_FRIENDLY_VERSION.
  if (versionMatch[2] === undefined && isSupportedVersion(line.value, major, minor)) return line.value;

  const replacement = PARSER_FRIENDLY_VERSION.padEnd(versionMatch[0].length, ' ');
  out.set(new TextEncoder().encode(replacement), base + line.offset + versionMatch.index);

  return line.value;
}

/**
 * Blank out a `debug_mode` the bundled parser doesn't know about.
 *
 * The parser decodes this header against Betaflight 4.4's enum and throws
 * ("invalid value for header `debug_mode`: `97`") on anything past 78, which
 * takes down the whole log — even though the value is a label that has no
 * bearing on how frames are decoded. Newer firmware routinely exceeds 78:
 * `CHIRP` is 97 in BF 2025.12.
 *
 * So the value becomes 0 (`NONE`) and the real number is handed back for
 * display. Leading zeros keep the byte length identical ("97" → "00"); Rust's
 * integer parser accepts them, trailing spaces it would not.
 */
function patchDebugMode(out: Uint8Array, head: string, base: number): number | null {
  // Anchor on the newline so `H gyro_debug_mode:`-style headers can't match.
  const line = headerValue(head, `\n${DEBUG_MODE_HEADER_PREFIX}`);
  if (!line || !/^\d+$/.test(line.value)) return null;
  const value = Number.parseInt(line.value, 10);

  // In range — leave it alone so the parser names it for us.
  if (value > MAX_PARSER_DEBUG_MODE)
    out.set(new TextEncoder().encode('0'.repeat(line.value.length)), base + line.offset);

  return value;
}

/** Byte offsets where each flight's header starts; a file without the marker is one flight from 0. */
function headerStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = text.indexOf(HEADER_START); i >= 0; i = text.indexOf(HEADER_START, i + 1)) starts.push(i);

  return starts.length > 0 ? starts : [0];
}

/**
 * Apply every in-place header rewrite the bundled parser needs, to the header
 * of each flight in the file. Returns a patched copy (the input is untouched)
 * and each flight's original firmware line and debug mode, in file order.
 */
export function patchHeaders(input: Uint8Array): { patched: Uint8Array; originals: OriginalHeader[] } {
  const patched = new Uint8Array(input);
  const decoder = new TextDecoder('latin1');
  const originals = headerStarts(decoder.decode(input)).map((base) => {
    const head = decoder.decode(input.subarray(base, Math.min(input.byteLength, base + HEADER_SCAN_BYTES)));

    return { firmwareLine: patchFirmwareVersion(patched, head, base), debugMode: patchDebugMode(patched, head, base) };
  });

  return { patched, originals };
}
