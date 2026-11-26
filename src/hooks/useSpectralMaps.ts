import { useMemo } from 'react';

import { motorRpmSeries } from '../dsp/spectrum/motorRpmSeries';
import { throttlePercentSeries } from '../dsp/throttlePercentSeries';
import type { ParsedLog, SpectralMode, SpectrogramSource } from '../types';
import { errorSetpointForAxis } from '../utils/errorSetpointForAxis';
import { isBinnedMode } from '../utils/isBinnedMode';
import { isRpmMode } from '../utils/isRpmMode';
import { isTimeMode } from '../utils/isTimeMode';
import { modeValueKind } from '../utils/modeValueKind';
import { robustPsdRange } from '../utils/robustPsdRange';
import { rpmHzDomain } from '../utils/rpmHzDomain';
import { spectralBinnedMap } from '../utils/spectralBinnedMap';
import { spectralTimeMap } from '../utils/spectralTimeMap';

interface SpectralChoice {
  mode: SpectralMode;
  axis: number;
  source: SpectrogramSource;
  windowSize: number;
  compensateLag: boolean;
}

/** The Spectral tab's data for the chosen mode: only the map that mode shows is computed. */
export function useSpectralMaps(log: ParsedLog, { mode, axis, source, windowSize, compensateLag }: SpectralChoice) {
  const valueMode = modeValueKind(mode);
  const rpmDomain = useMemo(() => rpmHzDomain(motorRpmSeries(log)), [log]);

  // Time-domain spectrogram (Frequency / PSD).
  const spec = useMemo(
    () => (isTimeMode(mode) ? spectralTimeMap(log, axis, source, windowSize, modeValueKind(mode)) : null),
    [log, windowSize, source, mode, axis],
  );

  // Binned spectrogram (vs Throttle / vs RPM); null in RPM mode without telemetry.
  const binned = useMemo(() => {
    if (!isBinnedMode(mode)) return null;
    const domain = isRpmMode(mode) ? rpmDomain : { series: throttlePercentSeries(log), max: 100 };

    return domain ? spectralBinnedMap(log, axis, source, domain, modeValueKind(mode)) : null;
  }, [log, mode, axis, source, rpmDomain]);

  const density = useMemo(
    () => (mode === 'errorSetpoint' ? errorSetpointForAxis(log, axis, compensateLag) : null),
    [log, mode, axis, compensateLag],
  );

  // PSD colour scale: robust auto default.
  const autoRange = useMemo(() => {
    if (valueMode !== 'psd') return { floor: -80, ceil: 0 };

    return robustPsdRange([spec?.magnitudes, binned?.magnitudes].filter((a): a is Float32Array => a != null));
  }, [valueMode, spec, binned]);

  return { valueMode, spec, binned, density, autoRange, rpmUnavailable: isRpmMode(mode) && !rpmDomain };
}
