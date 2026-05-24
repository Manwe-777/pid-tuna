/**
 * Web Serial implementation of `FcPort`. Used in browsers (Chrome / Edge /
 * Opera) and also inside Tauri's WebView2 on Windows (which exposes
 * navigator.serial). On macOS WKWebView and Linux WebKitGTK the Web Serial
 * API isn't available; those paths use `portTauri.ts` via the Rust serial
 * commands instead.
 */

import { FC_USB_FILTERS, type FcPort } from './port';

/**
 * Pop the browser's port-picker dialog filtered to known FC USB IDs and
 * open the user's selection at 115200 baud (MSP default).
 *
 * Must be called from a user gesture handler (click, etc.) — `requestPort`
 * throws otherwise.
 */
export async function openWebSerialPort(): Promise<FcPort> {
  // Web Serial isn't in lib.dom.d.ts yet — cast through unknown and feature
  // the slice of the API we actually use.
  const serial = (navigator as unknown as {
    serial: {
      requestPort(options: {
        filters: Array<{ usbVendorId: number; usbProductId: number }>;
      }): Promise<SerialPortLike>;
    };
  }).serial;
  const filters = FC_USB_FILTERS.map((f) => ({
    usbVendorId: f.vendorId,
    usbProductId: f.productId,
  }));
  const port = await serial.requestPort({ filters });
  await port.open({ baudRate: 115200 });
  return new WebSerialFcPort(port);
}

/** Subset of the Web Serial API surface we actually depend on. */
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

class WebSerialFcPort implements FcPort {
  readonly label: string;
  private readonly port: SerialPortLike;
  /** Pre-buffered bytes that arrived before `read()` was called for them. */
  private buffer: Uint8Array = new Uint8Array(0);
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closed = false;

  constructor(port: SerialPortLike) {
    this.port = port;
    const info = port.getInfo();
    const vid = info.usbVendorId?.toString(16).padStart(4, '0') ?? '????';
    const pid = info.usbProductId?.toString(16).padStart(4, '0') ?? '????';
    this.label = `USB ${vid}:${pid}`;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port.writable) throw new Error('Port has no writable stream');
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async read(len: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.port.readable) throw new Error('Port has no readable stream');
    if (this.buffer.length >= len) return this.take(len);

    if (!this.reader) this.reader = this.port.readable.getReader();
    const deadline = performance.now() + timeoutMs;

    while (this.buffer.length < len) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error(`Read timeout (got ${this.buffer.length}/${len} bytes)`);
      const chunk = await Promise.race([
        this.reader.read(),
        new Promise<{ value?: Uint8Array; done: true }>((resolve) =>
          setTimeout(() => resolve({ done: true }), remaining),
        ),
      ]);
      if (chunk.done) {
        if (this.buffer.length < len) throw new Error(`Read timeout (got ${this.buffer.length}/${len} bytes)`);
        break;
      }
      if (chunk.value) this.append(chunk.value);
    }
    return this.take(len);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch {
          /* port may have already dropped (e.g. FC rebooting into MSC) */
        }
        try {
          this.reader.releaseLock();
        } catch { /* ignore */ }
        this.reader = null;
      }
      await this.port.close();
    } catch {
      // Closing a port that's already gone (FC rebooted) is the expected
      // post-MSC outcome — don't surface as an error.
    }
  }

  private append(more: Uint8Array): void {
    const merged = new Uint8Array(this.buffer.length + more.length);
    merged.set(this.buffer, 0);
    merged.set(more, this.buffer.length);
    this.buffer = merged;
  }

  private take(n: number): Uint8Array {
    const out = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return out;
  }
}
