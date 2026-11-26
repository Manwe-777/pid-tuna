import type { ByteReader } from './ByteReader';
import { signExtend } from './signExtend';

/**
 * Reads three values whose sizes (1 to 4 bytes, little-endian) are given two bits each
 * by `selector`, first value in the low bits. Shared by the 2-bit-tag encodings.
 */
export function readTagBytes(r: ByteReader, selector: number, values: number[]): void {
  let sel = selector;

  for (let i = 0; i < 3; i++, sel >>= 2) {
    const bytes = (sel & 0x03) + 1;
    let v = 0;
    for (let b = 0; b < bytes; b++) v |= r.byte() << (8 * b);
    values[i] = bytes === 4 ? v | 0 : signExtend(v, bytes * 8);
  }
}
