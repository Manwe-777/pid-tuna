export function usableFraction(mask: Uint8Array, start: number, len: number): number {
  let ok = 0;
  for (let i = 0; i < len; i++) ok += mask[start + i] ?? 0;

  return ok / len;
}
