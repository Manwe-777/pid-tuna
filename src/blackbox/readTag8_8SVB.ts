import type { ByteReader } from './ByteReader';

/**
 * Up to eight signed variable-byte values behind a byte whose bits say which are non-zero.
 * A group of one has no header byte.
 */
export function readTag8_8SVB(r: ByteReader, values: number[], count: number): void {
  if (count === 1) {
    values[0] = r.signedVB();

    return;
  }

  let header = r.byte();
  for (let i = 0; i < 8; i++, header >>= 1) values[i] = header & 0x01 ? r.signedVB() : 0;
}
