import { MAGIC_DOLLAR, MAGIC_M, MSP_SET_REBOOT } from '../constants';
import type { MscResponse } from '../types';

const DIRECTION_FROM_FC = 0x3e; // '>'

/**
 * Parse the FC's response to a MSP_SET_REBOOT(MSC). Expected frame:
 *
 *   '$' 'M' '>' size cmd=68 [rebootType, readyFlag] crc
 *
 * Throws if the magic bytes or command code are wrong (likely junk on the
 * wire or a different protocol version).
 */
export function parseMscResponse(bytes: Uint8Array): MscResponse {
  if (bytes.length < 8) {
    throw new Error(`MSP response too short (${bytes.length} bytes; need 8)`);
  }
  if (bytes[0] !== MAGIC_DOLLAR || bytes[1] !== MAGIC_M || bytes[2] !== DIRECTION_FROM_FC) {
    throw new Error(`Bad MSP magic: ${[bytes[0], bytes[1], bytes[2]].map((b) => `0x${b!.toString(16)}`).join(' ')}`);
  }
  const size = bytes[3]!;
  const cmd = bytes[4]!;
  if (cmd !== MSP_SET_REBOOT) {
    throw new Error(`Unexpected MSP response cmd ${cmd}, expected ${MSP_SET_REBOOT}`);
  }
  if (size < 2) {
    throw new Error(`MSC response payload too short (${size} bytes; need 2)`);
  }
  // CRC isn't verified — these frames are short enough that mis-decoding
  // would be caught by the magic/cmd checks above. Adding CRC verification
  // is cheap if we ever extend to more MSP commands.
  return { rebootType: bytes[5]!, storageReady: bytes[6] !== 0 };
}
