import { invoke } from '@tauri-apps/api/core';

import type { FcPort, TauriFcPortInfo } from '../types';

/**
 * Open the named serial port at 115200 baud. Caller is responsible for
 * eventually calling `close()` on the returned port.
 */
export async function openTauriPort(info: TauriFcPortInfo): Promise<FcPort> {
  const handle = await invoke<number>('fc_serial_open', {
    path: info.path,
    baudRate: 115200,
  });
  const label = info.product
    ? `${info.product} (${info.path})`
    : `USB ${info.vendor_id.toString(16).padStart(4, '0')}:${info.product_id
        .toString(16)
        .padStart(4, '0')} (${info.path})`;
  return new TauriFcPort(handle, label);
}

class TauriFcPort implements FcPort {
  readonly label: string;
  private readonly handle: number;
  private closed = false;

  constructor(handle: number, label: string) {
    this.handle = handle;
    this.label = label;
  }

  async write(data: Uint8Array): Promise<void> {
    await invoke('fc_serial_write', {
      handle: this.handle,
      data: Array.from(data),
    });
  }

  async read(len: number, timeoutMs: number): Promise<Uint8Array> {
    const bytes = await invoke<number[]>('fc_serial_read', {
      handle: this.handle,
      len,
      timeoutMs,
    });
    return new Uint8Array(bytes);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    try {
      await invoke('fc_serial_close', { handle: this.handle });
    } catch {
      // FC rebooting into MSC drops the port; not a real error.
    }
  }
}
