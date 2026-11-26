import { isTauri } from '../../msp/isTauri';
import type { Phase } from '../../types';
import { isMacLike } from '../../utils/isMacLike';
import { PanelLayout } from './PanelLayout';

export function FcMscPanel({
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
            Plug your Betaflight FC into USB, then click <strong>Connect</strong>. PIDTuna will ask the FC to enter
            mass-storage mode and mount its SD card / onboard flash as a removable drive — find it in{' '}
            {isMacLike() ? 'Finder' : 'your file explorer'}, copy the <code>.BBL</code> files off, and eject the drive
            when you&apos;re done.
          </p>
          <p className="muted text-[0.8rem]">
            Nothing is written to the FC. The only command sent is a one-byte request to reboot into mass-storage mode.
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
          <p>The FC just rebooted and should appear as a removable drive within a few seconds.</p>
          <ol className="fc-msc__steps">
            <li>Open {isMacLike() ? 'Finder' : 'File Explorer'} and look for a new USB drive.</li>
            <li>
              Copy the <code>.BBL</code> files (usually under <code>LOGS/</code>) somewhere local.
            </li>
            <li>
              <strong>Eject</strong> the drive (don&apos;t just unplug it) — that triggers the FC to reboot back to
              flight mode.
            </li>
            <li>Drag the copied logs into PIDTuna&apos;s sidebar to analyse them.</li>
          </ol>
        </PanelLayout>
      );
    case 'error':
      return (
        <PanelLayout title="Couldn’t switch the FC" onClose={onClose}>
          <p className="fc-msc__error">{phase.message}</p>
          <p className="muted text-[0.8rem]">
            Common causes: the FC is in bootloader / DFU mode, no SD card present, Blackbox set to a destination other
            than SD or flash, or the USB driver isn&apos;t installed (Windows users may need the STM32 VCP driver).
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
            This browser doesn&apos;t expose <code>navigator.serial</code>, which is what PIDTuna uses to talk to the
            FC. Two options:
          </p>
          <ul className="fc-msc__steps">
            <li>
              Open this page in <strong>Chrome</strong>, <strong>Edge</strong>, or
              <strong> Opera</strong> — Web Serial works there out of the box.
            </li>
            <li>
              Or download the <strong>desktop app</strong> from the{' '}
              <a href="https://github.com/Manwe-777/pid-tuna/releases/latest" target="_blank" rel="noreferrer noopener">
                latest release
              </a>{' '}
              — it uses native USB serial and works on Firefox/Safari users&apos; machines too.
            </li>
          </ul>
        </PanelLayout>
      );
  }
}
