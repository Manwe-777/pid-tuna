/**
 * Returns true when the host browser exposes the Web Serial API. False on
 * Firefox, Safari, and any non-secure context.
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}
