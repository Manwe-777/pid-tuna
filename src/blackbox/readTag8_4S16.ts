import type { ByteReader } from './ByteReader';
import { signExtend } from './signExtend';

const ZERO = 0;

const NIBBLE = 1;

const BYTE = 2;

/**
 * Four signed values of 0, 4, 8 or 16 bits, sizes given two bits each by a leading selector.
 * Data version 2 packs them nibble-aligned and big-endian, version 1 byte-aligned and little-endian.
 */
export function readTag8_4S16(r: ByteReader, values: number[], dataVersion: number): void {
  if (dataVersion < 2) readV1(r, values);
  else readV2(r, values);
}

function readV1(r: ByteReader, values: number[]) {
  let selector = r.byte();

  for (let i = 0; i < 4; i++, selector >>= 2) {
    switch (selector & 0x03) {
      case ZERO:
        values[i] = 0;
        break;

      case NIBBLE: {
        // Two 4-bit fields share one byte, low nibble first.
        const b = r.byte();
        values[i] = signExtend(b & 0x0f, 4);
        i++;
        selector >>= 2;
        values[i] = signExtend(b >> 4, 4);
        break;
      }

      case BYTE:
        values[i] = r.s8();
        break;
      default:
        values[i] = r.s16();
    }
  }
}

function readV2(r: ByteReader, values: number[]) {
  const selector = r.byte();
  const state = { buffer: 0, half: false };

  for (let i = 0; i < 4; i++) values[i] = readV2Value(r, (selector >> (2 * i)) & 0x03, state);
}

/** One value of a version 2 group; `state.half` is set while a byte's low nibble is still unread. */
function readV2Value(r: ByteReader, size: number, state: { buffer: number; half: boolean }): number {
  if (size === ZERO) return 0;

  if (size === NIBBLE) {
    if (!state.half) state.buffer = r.byte();
    state.half = !state.half;

    return signExtend(state.half ? state.buffer >> 4 : state.buffer & 0x0f, 4);
  }

  if (!state.half) return size === BYTE ? r.s8() : signExtend((r.byte() << 8) | r.byte(), 16);

  if (size === BYTE) {
    const hi = (state.buffer & 0x0f) << 4;
    state.buffer = r.byte();

    return signExtend(hi | (state.buffer >> 4), 8);
  }

  const b1 = r.byte();
  const b2 = r.byte();
  const v = ((state.buffer & 0x0f) << 12) | (b1 << 4) | (b2 >> 4);
  state.buffer = b2;

  return signExtend(v, 16);
}
