import type { ByteReader } from './ByteReader';
import { readTagBytes } from './readTagBytes';
import { signExtend } from './signExtend';

/**
 * Three signed values packed as 2+2+2, 5+5+4 or 8+7+7 bits, or 1 to 4 bytes each, chosen by a
 * 2-bit tag. Follows Betaflight's encoder (blackboxWriteTag2_3SVariable).
 */
export function readTag2_3SVariable(r: ByteReader, values: number[]): void {
  const lead = r.byte();

  switch (lead >> 6) {
    case 0:
      values[0] = signExtend((lead >> 4) & 0x03, 2);
      values[1] = signExtend((lead >> 2) & 0x03, 2);
      values[2] = signExtend(lead & 0x03, 2);
      break;

    case 1: {
      // ss11 1112 2222 3333
      const b1 = r.byte();
      values[0] = signExtend((lead >> 1) & 0x1f, 5);
      values[1] = signExtend(((lead & 0x01) << 4) | (b1 >> 4), 5);
      values[2] = signExtend(b1 & 0x0f, 4);
      break;
    }

    case 2: {
      // ss11 1111 1122 2222 2333 3333
      const b1 = r.byte();
      const b2 = r.byte();
      values[0] = signExtend(((lead & 0x3f) << 2) | (b1 >> 6), 8);
      values[1] = signExtend(((b1 & 0x3f) << 1) | (b2 >> 7), 7);
      values[2] = signExtend(b2 & 0x7f, 7);
      break;
    }

    default:
      readTagBytes(r, lead, values);
  }
}
