import { ALL_AXIS } from '../constants';
import { computeBinnedSpectrogram } from '../dsp/spectrum/computeBinnedSpectrogram';
import type { BinnedSpectrogramResult, ParsedLog, SpectralValueMode, SpectrogramSource } from '../types';
import { combineAxisPowerDb } from './combineAxisPowerDb';
import { gyroSignal } from './gyroSignal';

/**
 * Spectrum binned by a domain series (throttle % or motor frequency) for one
 * axis, or for all axes with their power summed.
 */
export function spectralBinnedMap(
  log: ParsedLog,
  axis: number,
  source: SpectrogramSource,
  domain: { series: Float32Array; max: number },
  valueMode: SpectralValueMode,
): BinnedSpectrogramResult {
  const rate = log.setup.sampleRateHz;
  const range = { domainMin: 0, domainMax: domain.max };

  if (axis !== ALL_AXIS) {
    return computeBinnedSpectrogram(gyroSignal(log, source, axis), domain.series, rate, { mode: valueMode, ...range });
  }

  const per = [0, 1, 2].map((i) =>
    computeBinnedSpectrogram(gyroSignal(log, source, i), domain.series, rate, { mode: 'psd', ...range }),
  );

  return {
    ...per[0]!,
    magnitudes: combineAxisPowerDb(
      per.map((p) => p.magnitudes),
      valueMode,
    ),
    valueMode,
  };
}
