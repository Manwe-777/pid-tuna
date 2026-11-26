import { useMemo, useState } from 'react';

import { DYN_NOTCH_COLOR } from '../constants';
import { dynNotchMedians } from '../dsp/spectrum/dynNotchMedians';
import { harmonicNoiseForLog } from '../dsp/spectrum/harmonicNoiseForLog';
import type { ParsedLog, PlotMarker } from '../types';
import { computeRpmMarkers } from '../utils/computeRpmMarkers';
import { initialPolePairs } from '../utils/initialPolePairs';
import { toggleInSet } from '../utils/toggleInSet';

/** RPM-harmonic and dynamic-notch markers for the spectrum plots, with the settings that drive them. */
export function useSpectrumMarkers(log: ParsedLog) {
  const hasRpm = useMemo(() => log.eRpm.length > 0 && log.eRpm.some((a) => a.some((v) => v > 0)), [log]);
  const [polePairs, setPolePairs] = useState<number>(() => initialPolePairs(log));
  const [blades, setBlades] = useState<number>(2);
  const [harmonics, setHarmonics] = useState<number>(3);
  const [showDynNotches, setShowDynNotches] = useState(true);
  const [enabledMotors, setEnabledMotors] = useState<ReadonlySet<number>>(() => new Set(log.eRpm.map((_, i) => i)));
  const dynNotchHz = useMemo(() => dynNotchMedians(log), [log]);
  const harmonicNoise = useMemo(
    () => (hasRpm ? harmonicNoiseForLog(log, polePairs, harmonics) : null),
    [log, hasRpm, polePairs, harmonics],
  );

  const { markers: motorMarkers, perMotor } = useMemo(
    () => computeRpmMarkers(log, enabledMotors, polePairs, blades, harmonics),
    [log, enabledMotors, polePairs, blades, harmonics],
  );
  const markers = useMemo<PlotMarker[]>(
    () => [
      ...motorMarkers,
      ...(showDynNotches ? dynNotchHz.map((x) => ({ x, stroke: DYN_NOTCH_COLOR, width: 1.5, dash: [2, 3] })) : []),
    ],
    [motorMarkers, showDynNotches, dynNotchHz],
  );

  return {
    hasRpm,
    markers,
    perMotor,
    dynNotchHz,
    harmonicNoise,
    rpm: {
      enabledMotors,
      toggleMotor: (i: number) => setEnabledMotors((prev) => toggleInSet(prev, i)),
      polePairs,
      setPolePairs,
      blades,
      setBlades,
      harmonics,
      setHarmonics,
    },
    showDynNotches,
    setShowDynNotches,
  };
}
