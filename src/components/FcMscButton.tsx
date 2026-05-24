/**
 * "Get logs from FC" header button: connects to a Betaflight FC over USB,
 * sends the one MSP frame that triggers mass-storage mode, then tells the
 * user what to do next (find the new USB drive, copy `.BBL` files, eject).
 *
 * Transport is auto-selected: Tauri → Rust serialport; browser with Web
 * Serial → navigator.serial; everything else → friendly fallback message
 * pointing at Chrome / Edge or the desktop app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildMscRequest, parseMscResponse } from '../msp/msc';
import { isTauri, isWebSerialSupported, type FcPort } from '../msp/port';

type Phase =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'sending'; portLabel: string }
  | { kind: 'success'; portLabel: string }
  | { kind: 'error'; message: string }
  | { kind: 'unsupported' };

export function FcMscButton() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [panelOpen, setPanelOpen] = useState(false);
  const portRef = useRef<FcPort | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close the panel on outside click / Escape.
  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [panelOpen]);

  const runMscFlow = useCallback(async () => {
    setPhase({ kind: 'connecting' });
    try {
      const port = await acquirePort();
      portRef.current = port;
      setPhase({ kind: 'sending', portLabel: port.label });

      await port.write(buildMscRequest());

      // The FC accepts the command and reboots into MSC fast enough that the
      // USB device often vanishes mid-response. Three outcomes from `read`:
      //
      //   1. full valid response, storageReady=true  → unambiguous success
      //   2. full valid response, storageReady=false → FC said "no storage,
      //      didn't reboot" — show the user a real error
      //   3. read timeout / partial / "device lost"   → FC almost certainly
      //      rebooted into MSC mid-response. Treat as success — the alternative
      //      (showing an error for a flow that actually worked) was worse.
      //
      // We only ever surface a failure if the FC explicitly told us "no".
      let response: Uint8Array | null = null;
      try {
        response = await port.read(8, 1500);
      } catch (readErr) {
        console.warn(
          '[MSC] no response after MSC request (FC likely rebooted before ACK):',
          readErr,
        );
      }
      if (response) {
        try {
          const parsed = parseMscResponse(response);
          if (!parsed.storageReady) {
            setPhase({
              kind: 'error',
              message:
                'FC reports no storage device — check that the SD card is inserted and Blackbox is set to write to it (or to onboard flash).',
            });
            return;
          }
        } catch (parseErr) {
          // Garbage / truncated response — FC was already mid-reboot.
          console.warn('[MSC] could not parse response (truncated reboot):', parseErr);
        }
      }
      setPhase({ kind: 'success', portLabel: port.label });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase({ kind: 'error', message });
    } finally {
      // FC reboots immediately on success — closing a dropped port is fine.
      try {
        await portRef.current?.close();
      } catch {
        /* ignore */
      }
      portRef.current = null;
    }
  }, []);

  const onButtonClick = useCallback(() => {
    setPanelOpen(true);
    // If the runtime can't handle this at all, show the explainer rather
    // than failing on connect.
    if (!isTauri() && !isWebSerialSupported()) {
      setPhase({ kind: 'unsupported' });
      return;
    }
    setPhase({ kind: 'idle' });
  }, []);

  const onConnect = useCallback(() => {
    void runMscFlow();
  }, [runMscFlow]);

  const buttonDisabled = phase.kind === 'connecting' || phase.kind === 'sending';

  return (
    <div className="fc-msc">
      <button
        type="button"
        className="fc-msc__button"
        onClick={onButtonClick}
        disabled={buttonDisabled}
        aria-label="Connect FC over USB"
        title="Connect to a Betaflight FC over USB and switch it to mass-storage mode"
      >
        <UsbIcon className="fc-msc__icon" />
      </button>
      <span className="fc-msc__label">Connect FC</span>

      {panelOpen && (
        <div className="fc-msc__panel" ref={panelRef}>
          <FcMscPanel phase={phase} onConnect={onConnect} onClose={() => setPanelOpen(false)} />
        </div>
      )}
    </div>
  );
}

async function acquirePort(): Promise<FcPort> {
  if (isTauri()) {
    const { listTauriFcPorts, openTauriPort } = await import('../msp/portTauri');
    const ports = await listTauriFcPorts();
    if (ports.length === 0) {
      throw new Error(
        'No FC detected. Plug the FC into USB and click again — make sure it powers up in flight mode, not bootloader.',
      );
    }
    if (ports.length > 1) {
      // Cheap heuristic: prefer the first match. A multi-FC picker is more
      // work than this feature deserves; users with multiple boards plugged
      // in at once can unplug the wrong one.
      console.warn(
        `Multiple FC candidates found, using ${ports[0]!.path}:`,
        ports.map((p) => p.path),
      );
    }
    return openTauriPort(ports[0]!);
  }
  if (isWebSerialSupported()) {
    const { openWebSerialPort } = await import('../msp/portWeb');
    return openWebSerialPort();
  }
  throw new Error('No USB serial transport available in this runtime.');
}

function FcMscPanel({
  phase,
  onConnect,
  onClose,
}: {
  phase: Phase;
  onConnect: () => void;
  onClose: () => void;
}) {
  switch (phase.kind) {
    case 'idle':
      return (
        <PanelLayout title="Pull logs straight off the FC" onClose={onClose}>
          <p className="muted">
            Plug your Betaflight FC into USB, then click <strong>Connect</strong>. PIDTuna will
            ask the FC to enter mass-storage mode and mount its SD card / onboard flash as a
            removable drive — find it in {isMacLike() ? 'Finder' : 'your file explorer'}, copy
            the <code>.BBL</code> files off, and eject the drive when you&apos;re done.
          </p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Nothing is written to the FC. The only command sent is a one-byte request to reboot
            into mass-storage mode.
          </p>
          <div className="fc-msc__actions">
            <button type="button" className="fc-msc__primary" onClick={onConnect}>
              Connect
            </button>
          </div>
        </PanelLayout>
      );
    case 'connecting':
      return (
        <PanelLayout title="Connecting…" onClose={onClose}>
          <p className="muted">
            {isTauri()
              ? 'Looking for a Betaflight FC on the system serial ports…'
              : 'Pick your FC in the browser dialog that just appeared.'}
          </p>
        </PanelLayout>
      );
    case 'sending':
      return (
        <PanelLayout title="Switching FC to mass-storage mode…" onClose={onClose}>
          <p className="muted">
            Connected to <code>{phase.portLabel}</code>. Sending the MSC reboot command…
          </p>
        </PanelLayout>
      );
    case 'success':
      return (
        <PanelLayout title="✓ FC is in mass-storage mode" onClose={onClose}>
          <p>
            The FC just rebooted and should appear as a removable drive within a few seconds.
          </p>
          <ol className="fc-msc__steps">
            <li>Open {isMacLike() ? 'Finder' : 'File Explorer'} and look for a new USB drive.</li>
            <li>
              Copy the <code>.BBL</code> files (usually under <code>LOGS/</code>) somewhere
              local.
            </li>
            <li>
              <strong>Eject</strong> the drive (don&apos;t just unplug it) — that triggers the
              FC to reboot back to flight mode.
            </li>
            <li>
              Drag the copied logs into PIDTuna&apos;s sidebar to analyse them.
            </li>
          </ol>
        </PanelLayout>
      );
    case 'error':
      return (
        <PanelLayout title="Couldn’t switch the FC" onClose={onClose}>
          <p className="fc-msc__error">{phase.message}</p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Common causes: the FC is in bootloader / DFU mode, no SD card present, Blackbox set
            to a destination other than SD or flash, or the USB driver isn&apos;t installed
            (Windows users may need the STM32 VCP driver).
          </p>
          <div className="fc-msc__actions">
            <button type="button" className="fc-msc__primary" onClick={onConnect}>
              Try again
            </button>
          </div>
        </PanelLayout>
      );
    case 'unsupported':
      return (
        <PanelLayout title="USB connect needs Chrome, Edge, or the desktop app" onClose={onClose}>
          <p>
            This browser doesn&apos;t expose <code>navigator.serial</code>, which is what
            PIDTuna uses to talk to the FC. Two options:
          </p>
          <ul className="fc-msc__steps">
            <li>
              Open this page in <strong>Chrome</strong>, <strong>Edge</strong>, or
              <strong> Opera</strong> — Web Serial works there out of the box.
            </li>
            <li>
              Or download the <strong>desktop app</strong> from the{' '}
              <a
                href="https://github.com/Manwe-777/pid-tuna/releases/latest"
                target="_blank"
                rel="noreferrer noopener"
              >
                latest release
              </a>{' '}
              — it uses native USB serial and works on Firefox/Safari users&apos; machines too.
            </li>
          </ul>
        </PanelLayout>
      );
  }
}

function PanelLayout({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fc-msc__panel-head">
        <span className="fc-msc__panel-title">{title}</span>
        <button
          type="button"
          className="fc-msc__close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className="fc-msc__panel-body">{children}</div>
    </>
  );
}

function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/**
 * USB connector icon. Single-path SVG sourced from SVG Repo
 * (https://www.svgrepo.com/svg/507091/usb-connection — CC0). Inlined here so
 * the fill follows `currentColor` and reacts to the button's hover state.
 */
function UsbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 222.856 222.856"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M150.917,0l-41.326,41.327l-8.886-8.885l-67.994,67.997l13.427,13.427l-31.362,38.218l17.856,17.856L0,202.572l20.284,20.284l32.633-32.633l17.855,17.854l38.218-31.36l13.428,13.428l67.995-67.997l-8.882-8.882l41.325-41.326L150.917,0z M168.675,100.41l-6.972-6.972l11.571-11.569l-11.999-12.002l-11.572,11.57l-8.285-8.284l11.571-11.573l-11.999-11.997l-11.57,11.572l-6.972-6.972l28.47-28.471l46.227,46.228L168.675,100.41z" />
    </svg>
  );
}
