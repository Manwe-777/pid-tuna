import { useCallback, useEffect, useRef, useState } from 'react';

import { buildMscRequest } from '../../msp/buildMscRequest';
import { isWebSerialSupported } from '../../msp/isWebSerialSupported';
import { mscReplyError } from '../../msp/mscReplyError';
import type { FcPort, Phase } from '../../types';
import { isTauri } from '../../utils/isTauri';
import { UsbIcon } from '../icons/UsbIcon';
import { FcMscPanel } from './FcMscPanel';

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
        console.warn('[MSC] no response after MSC request (FC likely rebooted before ACK):', readErr);
      }

      const replyError = mscReplyError(response);

      if (replyError) {
        setPhase({ kind: 'error', message: replyError });
        return;
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
        <span className="fc-msc__label">Connect FC</span>
      </button>

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
    const [{ listTauriFcPorts }, { openTauriPort }] = await Promise.all([
      import('../../msp/listTauriFcPorts'),
      import('../../msp/openTauriPort'),
    ]);
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
    const { openWebSerialPort } = await import('../../msp/openWebSerialPort');
    return openWebSerialPort();
  }

  throw new Error('No USB serial transport available in this runtime.');
}
