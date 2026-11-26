import { parseMscResponse } from './parseMscResponse';

/**
 * The error to show for the FC's reply to the MSC request, or null when the FC
 * accepted or the reply is unreadable (it was already rebooting into MSC).
 */
export function mscReplyError(response: Uint8Array | null): string | null {
  if (!response) return null;

  try {
    if (parseMscResponse(response).storageReady) return null;

    return 'FC reports no storage device — check that the SD card is inserted and Blackbox is set to write to it (or to onboard flash).';
  } catch (parseErr) {
    // Garbage / truncated response — FC was already mid-reboot.
    console.warn('[MSC] could not parse response (truncated reboot):', parseErr);

    return null;
  }
}
