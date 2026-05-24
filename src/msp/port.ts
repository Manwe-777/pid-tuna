/**
 * Transport contract for talking to a Betaflight FC over USB serial.
 *
 * Two implementations live alongside: `portWeb.ts` (navigator.serial) and
 * `portTauri.ts` (Rust serialport crate via invoke). Higher-level code
 * (`useMscFlow` in `FcMscButton.tsx`) only knows about this interface.
 */

export interface FcPort {
  /** Send raw bytes to the FC. Resolves once the buffer is queued for writing. */
  write(data: Uint8Array): Promise<void>;

  /**
   * Read up to `len` bytes from the FC. Resolves as soon as that many bytes
   * are available, or rejects after `timeoutMs` if not enough arrived.
   */
  read(len: number, timeoutMs: number): Promise<Uint8Array>;

  /** Close the underlying port. Idempotent. */
  close(): Promise<void>;

  /** Human-readable label of the connected device, for logging. */
  readonly label: string;
}

/**
 * USB VID/PID pairs known to be Betaflight-compatible flight controllers and
 * the USB-CDC bridges flight controllers commonly expose. Copied from the
 * `serialDevices` array in betaflight-configurator/src/js/protocols/devices.js.
 */
export const FC_USB_FILTERS: ReadonlyArray<{ vendorId: number; productId: number; name: string }> = [
  { vendorId: 0x0403, productId: 0x6001, name: 'FT232R USB UART' },
  { vendorId: 0x0483, productId: 0x3256, name: 'STM32 HID' },
  { vendorId: 0x0483, productId: 0x374e, name: 'STM32 STLink VCP' },
  { vendorId: 0x0483, productId: 0x5740, name: 'STM32 Virtual COM Port' },
  { vendorId: 0x10c4, productId: 0xea60, name: 'Silicon Labs CP210x' },
  { vendorId: 0x10c4, productId: 0xea61, name: 'Silicon Labs CP210x' },
  { vendorId: 0x10c4, productId: 0xea62, name: 'Silicon Labs CP210x' },
  { vendorId: 0x28e9, productId: 0x018a, name: 'GD32 VCP' },
  { vendorId: 0x2e3c, productId: 0x5740, name: 'AT32 VCP' },
  { vendorId: 0x314b, productId: 0x5740, name: 'APM32 VCP' },
  { vendorId: 0x2e8a, productId: 0x0009, name: 'Raspberry Pi Pico VCP' },
];

/**
 * Returns true when the host browser exposes the Web Serial API. False on
 * Firefox, Safari, and any non-secure context.
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Returns true when the code is running inside Tauri's webview. Same check
 * we already use in `FilePicker.tsx`.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
