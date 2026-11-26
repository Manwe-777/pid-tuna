import type { ReactNode } from 'react';

import { ALL_AXIS, AXIS_NAMES, SPECTRAL_MODES, WINDOW_SIZES } from '../../constants';
import type { SpectralMode, SpectrogramSource } from '../../types';

interface Props {
  mode: SpectralMode;
  onMode: (m: SpectralMode) => void;
  axis: number;
  onAxis: (a: number) => void;
  source: SpectrogramSource;
  hasRaw: boolean;
  onSource: (s: SpectrogramSource) => void;
  /** Shown in time modes only. */
  windowSize: number | null;
  onWindowSize: (n: number) => void;
  maxFreq: number;
  maxFreqOptions: number[];
  onMaxFreq: (hz: number) => void;
  /** Extra controls at the end (the dB range). */
  children?: ReactNode;
}

/** Mode, axis, signal, window and max-frequency pickers for the Spectral tab. */
export function SpectralControls(p: Props) {
  const spectral = p.mode !== 'errorSetpoint';

  return (
    <div className="controls">
      <label>
        Mode:
        <select value={p.mode} onChange={(e) => p.onMode(e.target.value as SpectralMode)}>
          {SPECTRAL_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Axis:
        <select value={p.axis} onChange={(e) => p.onAxis(Number.parseInt(e.target.value, 10))}>
          <option value={ALL_AXIS}>All axes</option>
          {AXIS_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {spectral && (
        <label>
          Signal:
          <select
            value={p.source}
            onChange={(e) => p.onSource(e.target.value as SpectrogramSource)}
            disabled={!p.hasRaw}
          >
            <option value="filt">Filtered (gyroADC)</option>
            <option value="raw" disabled={!p.hasRaw}>
              Raw (gyroUnfilt){p.hasRaw ? '' : ' — not logged'}
            </option>
          </select>
        </label>
      )}
      {p.windowSize != null && (
        <label>
          Window:
          <select value={p.windowSize} onChange={(e) => p.onWindowSize(Number.parseInt(e.target.value, 10))}>
            {WINDOW_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {spectral && (
        <label>
          Max freq:
          <select value={p.maxFreq} onChange={(e) => p.onMaxFreq(Number.parseInt(e.target.value, 10))}>
            {p.maxFreqOptions.map((v) => (
              <option key={v} value={v}>
                {v} Hz
              </option>
            ))}
          </select>
        </label>
      )}
      {p.children}
    </div>
  );
}
