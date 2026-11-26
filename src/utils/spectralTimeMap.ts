import { ALL_AXIS } from '../constants';
import { computeSpectrogram } from '../dsp/spectrum/computeSpectrogram';
import type { ParsedLog, SpectralValueMode, SpectrogramResult, SpectrogramSource } from '../types';
import { combineAxisPowerDb } from './combineAxisPowerDb';
import { gyroSignal } from './gyroSignal';

/**
 * Time × frequency spectrogram for one axis, or for all axes with their power
 * summed (each axis computed as PSD, then combined into the requested scale).
 * The hop is 15 ms, at most half a window. Window times are log time.
 */
export function spectralTimeMap(
  log: ParsedLog,
  axis: number,
  source: SpectrogramSource,
  windowSize: number,
  valueMode: SpectralValueMode,
): SpectrogramResult {
  const rate = log.setup.sampleRateHz;
  const hopSize = Math.max(1, Math.min(windowSize >> 1, Math.round(rate * 0.015)));

  if (axis !== ALL_AXIS) {
    return computeSpectrogram(gyroSignal(log, source, axis), rate, {
      windowSize,
      hopSize,
      mode: valueMode,
      sampleTimes: log.time,
    });
  }

  const per = [0, 1, 2].map((i) =>
    computeSpectrogram(gyroSignal(log, source, i), rate, { windowSize, hopSize, mode: 'psd', sampleTimes: log.time }),
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
