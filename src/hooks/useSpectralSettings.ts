import { useState } from 'react';

import { ALL_AXIS } from '../constants';
import type { SpectralMode, SpectrogramSource } from '../types';

/** The Spectral tab's choices; raw gyro falls back to filtered when the log has none. */
export function useSpectralSettings(nyquist: number, hasRaw: boolean) {
  const [mode, setMode] = useState<SpectralMode>('freqTime');
  const [axis, setAxis] = useState<number>(ALL_AXIS); // 0=Roll, 1=Pitch, 2=Yaw, 3=All
  const [windowSize, setWindowSize] = useState<number>(512);
  const [source, setSource] = useState<SpectrogramSource>('filt');
  const [maxFreq, setMaxFreq] = useState<number>(Math.min(500, nyquist));
  const [compensateLag, setCompensateLag] = useState(true);
  // User overrides for the PSD colour scale (null = auto from data).
  const [dbMin, setDbMin] = useState<number | null>(null);
  const [dbMax, setDbMax] = useState<number | null>(null);

  return {
    mode,
    setMode,
    axis,
    setAxis,
    windowSize,
    setWindowSize,
    source: source === 'raw' && !hasRaw ? ('filt' as const) : source,
    setSource,
    maxFreq,
    setMaxFreq,
    compensateLag,
    setCompensateLag,
    dbMin,
    setDbMin,
    dbMax,
    setDbMax,
    resetDb: () => {
      setDbMin(null);
      setDbMax(null);
    },
  };
}
