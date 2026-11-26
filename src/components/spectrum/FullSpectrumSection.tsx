import { useMemo, useState } from 'react';

import { AXIS_NAMES, PSD_WINDOW_SIZES } from '../../constants';
import { useSignalSelection } from '../../hooks/useSignalSelection';
import { useSpectrumMarkers } from '../../hooks/useSpectrumMarkers';
import type { LogEntry } from '../../types';
import { psdAxisItems } from '../../utils/psdAxisItems';
import { signalAvailability } from '../../utils/signalAvailability';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { DynNotchToggle } from './DynNotchToggle';
import { MotorHarmonicTable } from './MotorHarmonicTable';
import { PsdAxisPlot } from './PsdAxisPlot';
import { RpmMarkerControls } from './RpmMarkerControls';
import { SignalPicker } from './SignalPicker';

export function FullSpectrumSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const signals = useSignalSelection(multi);
  const [windowSize, setWindowSize] = useState<number>(1024);
  const [yMin, setYMin] = useState<number>(-50);
  const [yMax, setYMax] = useState<number>(20);

  const spectrumMarkers = useSpectrumMarkers(log);
  const { hasRpm, perMotor, dynNotchHz, harmonicNoise, rpm, showDynNotches, setShowDynNotches } = spectrumMarkers;

  // Detect which signals are actually present (helps disable empty checkboxes).
  const availability = useMemo(() => signalAvailability(log), [log]);

  const psdByAxis = useMemo(
    () => AXIS_NAMES.map((_name, axis) => psdAxisItems(entries, signals.activeDefs, axis, windowSize, effectiveMerge)),
    [entries, signals.activeDefs, windowSize, effectiveMerge],
  );

  // Use the frequency vector from the first available PSD (they're identical
  // across signals since windowSize and sampleRate are shared).
  const freqVec = psdByAxis.find((items) => items.length > 0)?.[0]?.freq;

  return (
    <section className="plot-section">
      <h2>Full spectrum (PSD)</h2>
      <p className="muted">
        {effectiveMerge && `Pooling ${entries.length} logs into one weighted average. `}
        Welch's-method power spectral density. Overlay motor traces over gyro to identify which peaks come from motor
        harmonics vs. other noise sources.
      </p>

      <SignalPicker multi={multi} isChecked={signals.isChecked} available={availability} onPick={signals.pick} />

      <div className="controls">
        <label>
          FFT size:
          <select value={windowSize} onChange={(e) => setWindowSize(Number.parseInt(e.target.value, 10))}>
            {PSD_WINDOW_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Y min:
          <input
            className="w-18"
            type="number"
            step="5"
            value={yMin}
            onChange={(e) => setYMin(Number.parseFloat(e.target.value))}
          />
        </label>
        <label>
          Y max:
          <input
            className="w-18"
            type="number"
            step="5"
            value={yMax}
            onChange={(e) => setYMax(Number.parseFloat(e.target.value))}
          />
        </label>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      <RpmMarkerControls hasRpm={hasRpm} perMotor={perMotor} {...rpm} />

      {dynNotchHz.length > 0 && (
        <DynNotchToggle dynNotchHz={dynNotchHz} checked={showDynNotches} onChange={setShowDynNotches} />
      )}

      {harmonicNoise && (
        <details className="harmonic-noise" open>
          <summary>Noise at motor harmonics</summary>
          <p className="muted text-[0.78rem]">
            Peak noise within ±20 Hz of each multiple of motor speed (mean ± SD over the flight, takeoff to landing),
            and how much the gyro filters remove there. Uses {rpm.polePairs} pole pairs.
          </p>
          <MotorHarmonicTable axes={harmonicNoise} />
        </details>
      )}

      {!freqVec ? (
        <p className="muted">No selected signals are present in this window. Pick at least one from above.</p>
      ) : (
        AXIS_NAMES.map((name, axis) => (
          <PsdAxisPlot
            key={name}
            name={name}
            axis={axis}
            items={psdByAxis[axis]!}
            multi={multi}
            nyquist={nyquist}
            yMin={yMin}
            yMax={yMax}
            markers={spectrumMarkers.markers}
          />
        ))
      )}
    </section>
  );
}
