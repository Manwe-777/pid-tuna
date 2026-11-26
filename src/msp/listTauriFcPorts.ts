import { invoke } from '@tauri-apps/api/core';

import type { TauriFcPortInfo } from '../types';

/** List USB serial ports that match a known Betaflight FC USB ID. */
export async function listTauriFcPorts(): Promise<TauriFcPortInfo[]> {
  return invoke<TauriFcPortInfo[]>('fc_serial_list_ports');
}
