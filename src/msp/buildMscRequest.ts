import { MAGIC_DOLLAR, MAGIC_M, MSP_SET_REBOOT, REBOOT_TYPE_MSC } from '../constants';

const DIRECTION_TO_FC = 0x3c; // '<'

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
