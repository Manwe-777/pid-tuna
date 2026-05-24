/**
 * MSP v1 frame for triggering Betaflight's mass-storage (MSC) mode.
 *
 * The whole feature is one request frame and one response frame. After we
 * receive the OK response the FC reboots into MSC and the host OS mounts
 * the SD card / onboard flash as a removable USB drive — the user copies
 * `.BBL` files off, ejects, and the FC reboots back to flight mode on
 * its own.
 *
 * Pure functions only — no I/O. Transport lives behind `FcPort` so this
 * module is identical for browser (Web Serial) and desktop (Tauri).
 */

/** MSP command code: reboot the FC with a specified mode. */
export const MSP_SET_REBOOT = 68;

/** REBOOT_TYPE values. Mirrors REBOOT_TYPES in betaflight-configurator/MSPHelper.js. */
export const REBOOT_TYPE_FIRMWARE = 0;
export const REBOOT_TYPE_BOOTLOADER = 1;
export const REBOOT_TYPE_MSC = 2;
export const REBOOT_TYPE_MSC_UTC = 3;

const MAGIC_DOLLAR = 0x24; // '$'
const MAGIC_M = 0x4d; // 'M'
const DIRECTION_TO_FC = 0x3c; // '<'
const DIRECTION_FROM_FC = 0x3e; // '>'

/**
 * Build the 7-byte MSP_SET_REBOOT(MSC) request frame:
 *
 *   '$' 'M' '<' size=1 cmd=68 payload=2 crc=size^cmd^payload
 */
export function buildMscRequest(): Uint8Array {
  const size = 1;
  const cmd = MSP_SET_REBOOT;
  const payload = REBOOT_TYPE_MSC;
  const crc = size ^ cmd ^ payload;
  return new Uint8Array([MAGIC_DOLLAR, MAGIC_M, DIRECTION_TO_FC, size, cmd, payload, crc]);
}

export interface MscResponse {
  /** Echoed reboot type (should be 2 for MSC). */
  rebootType: number;
  /**
   * True when the FC accepted the reboot — storage device is ready and the
   * port will drop in a moment. False means SD card / flash isn't present.
   */
  storageReady: boolean;
}

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
    throw new Error(
      `Bad MSP magic: ${[bytes[0], bytes[1], bytes[2]].map((b) => `0x${b!.toString(16)}`).join(' ')}`,
    );
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
