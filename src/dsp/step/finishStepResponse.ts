import type { FrequencyMetrics, StepDiagnostics, StepResponseResult, StepSpectra } from '../../types';
import { meanOf } from '../../utils/meanOf';
import { metricSpread } from './metricSpread';
import { scaleToLevel } from './scaleToLevel';
import { spreadAround } from './spreadAround';
import { steadyIndex } from './steadyIndex';
import { stepFrequencyResponse } from './stepFrequencyResponse';
import { stepFromSpectra } from './stepFromSpectra';
import { timeMetrics } from './timeMetrics';

export function finishStepResponse(
  time: Float32Array,
  segments: Float32Array[],
  rejectedSegments: Float32Array[],
  spectra: StepSpectra | null,
  diagnostics: StepDiagnostics,
): StepResponseResult {
  const stepLen = time.length;
  const sampleTimeMs = stepLen > 1 ? time[1]! : 1;
  const steadyFrom = steadyIndex(sampleTimeMs, stepLen);
  const mean = spectra ? stepFromSpectra(spectra, stepLen) : new Float32Array(0);
  const level = meanOf(mean, steadyFrom, stepLen);
  for (const seg of segments) scaleToLevel(seg, steadyFrom, level);

  const freq = spectra ? stepFrequencyResponse(spectra) : null;

  return {
    time,
    segments,
    rejectedSegments,
    mean,
    spread: spreadAround(segments, mean),
    frequency: freq?.response ?? null,
    metricSpread: metricSpread(time, segments, steadyFrom),
    metrics: {
      ...timeMetrics(time, mean, steadyFrom),
      ...frequencyMetricFields(freq?.metrics),
    },
    diagnostics,
    pooled: spectra,
  };
}

/** The frequency-domain metrics, all null when there is no frequency response. */
function frequencyMetricFields(m: FrequencyMetrics | undefined): FrequencyMetrics {
  if (!m) {
    return {
      bandwidthHz: null,
      sensitivityPeakDb: null,
      sensitivityPeakHz: null,
      confidence: null,
      crossoverHz: null,
      phaseMarginDeg: null,
    };
  }

  return {
    bandwidthHz: m.bandwidthHz ?? null,
    sensitivityPeakDb: m.sensitivityPeakDb ?? null,
    sensitivityPeakHz: m.sensitivityPeakHz ?? null,
    confidence: m.confidence ?? null,
    crossoverHz: m.crossoverHz ?? null,
    phaseMarginDeg: m.phaseMarginDeg ?? null,
  };
}
