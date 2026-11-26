import type { ByteReader } from './ByteReader';
import { readTagBytes } from './readTagBytes';
import { signExtend } from './signExtend';

/** Three signed values packed as 2, 4 or 6 bits each, or 1 to 4 bytes each, chosen by a 2-bit tag. */
export function readTag2_3S32(r: ByteReader, values: number[]): void {
  const lead = r.byte();

  switch (lead >> 6) {
    case 0:
      values[0] = signExtend((lead >> 4) & 0x03, 2);
      values[1] = signExtend((lead >> 2) & 0x03, 2);
      values[2] = signExtend(lead & 0x03, 2);
      break;

    case 1: {
      values[0] = signExtend(lead & 0x0f, 4);
      const b = r.byte();
      values[1] = signExtend(b >> 4, 4);
      values[2] = signExtend(b & 0x0f, 4);
      break;
    }

    case 2:
      values[0] = signExtend(lead & 0x3f, 6);
      values[1] = signExtend(r.byte() & 0x3f, 6);
      values[2] = signExtend(r.byte() & 0x3f, 6);
      break;
    default:
      readTagBytes(r, lead, values);
  }
}
