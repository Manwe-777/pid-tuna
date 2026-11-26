import { useMemo, useState } from 'react';
import { AXIS_COLORS, AXIS_NAMES, DYN_NOTCH_COLOR, MOTOR_COLORS, PSD_WINDOW_SIZES, SIGNAL_DEFS } from '../../constants';
import { combinePsds } from '../../dsp/spectrum/combinePsds';
import { computePsd } from '../../dsp/spectrum/computePsd';
import { dynNotchMedians } from '../../dsp/spectrum/dynNotchMedians';
import { harmonicNoiseForLog } from '../../dsp/spectrum/harmonicNoiseForLog';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogEntry, LogSlot, PlotMarker, PlotSeries, PsdResult, SignalDef, SignalKey } from '../../types';
import { computeRpmMarkers } from '../../utils/computeRpmMarkers';
import { extractSignal } from '../../utils/extractSignal';
import { makeMergedSlot } from '../../utils/makeMergedSlot';
import { resampleY } from '../../utils/resampleY';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { MotorHarmonicTable } from './MotorHarmonicTable';

export function FullSpectrumSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const [selected, setSelected] = useState<ReadonlySet<SignalKey>>(() => new Set<SignalKey>(['gyroFilt']));
  // In multi-log mode, the same `selected` set is constrained to a single key.
  // First entry of `selected` is what we render.
  const singleSelected: SignalKey = multi ? ([...selected][0] ?? 'gyroFilt') : 'gyroFilt'; // unused in single mode
  const pickSingle = (key: SignalKey) => setSelected(new Set([key]));
  const [windowSize, setWindowSize] = useState<number>(1024);
  const [yMin, setYMin] = useState<number>(-50);
  const [yMax, setYMax] = useState<number>(20);

  // RPM markers state.
  const hasRpm = useMemo(() => log.eRpm.length > 0 && log.eRpm.some((a) => a.some((v) => v > 0)), [log]);
  const [polePairs, setPolePairs] = useState<number>(() => {
    const poles = Number.parseFloat(log.setup.rawHeaders.motor_poles ?? '');
    return poles >= 2 ? Math.round(poles / 2) : 7;
  });
  const [blades, setBlades] = useState<number>(2);
  const [showDynNotches, setShowDynNotches] = useState(true);
  const dynNotchHz = useMemo(() => dynNotchMedians(log), [log]);
  const [harmonics, setHarmonics] = useState<number>(3);
  const harmonicNoise = useMemo(
    () => (hasRpm ? harmonicNoiseForLog(log, polePairs, harmonics) : null),
    [log, hasRpm, polePairs, harmonics],
  );
  const [enabledMotors, setEnabledMotors] = useState<ReadonlySet<number>>(() => new Set(log.eRpm.map((_, i) => i)));

  const { markers: motorMarkers, perMotor } = useMemo(
    () => computeRpmMarkers(log, enabledMotors, polePairs, blades, harmonics),
    [log, enabledMotors, polePairs, blades, harmonics],
  );
  const rpmMarkers = useMemo<PlotMarker[]>(
    () => [
      ...motorMarkers,
      ...(showDynNotches ? dynNotchHz.map((x) => ({ x, stroke: DYN_NOTCH_COLOR, width: 1.5, dash: [2, 3] })) : []),
    ],
    [motorMarkers, showDynNotches, dynNotchHz],
  );

  const toggleMotor = (i: number) => {
    setEnabledMotors((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggle = (key: SignalKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Detect which signals are actually present (helps disable empty checkboxes).
  const availability = useMemo<Record<SignalKey, boolean>>(() => {
    const out = {} as Record<SignalKey, boolean>;
    for (const def of SIGNAL_DEFS) {
      const sample = extractSignal(log, def.key, 0);
      // Treat all-zero arrays as "not present" (e.g. unlogged gyroUnfilt).
      out[def.key] = !!sample && sample.length > 0 && sample.some((v) => v !== 0);
    }
    return out;
  }, [log]);

  // Which signal definitions are active for plotting?
  const activeDefs = useMemo(
    () =>
      multi ? SIGNAL_DEFS.filter((d) => d.key === singleSelected) : SIGNAL_DEFS.filter((d) => selected.has(d.key)),
    [multi, singleSelected, selected],
  );

  const psdByAxis = useMemo(() => {
    return AXIS_NAMES.map((_name, axis) => {
      const primaryRate = log.setup.sampleRateHz;
      const items: Array<{
        def: SignalDef;
        freq: Float32Array; // primary's frequency grid
        perLog: Array<{ slot: LogSlot; dash: number[]; psd: Float32Array }>;
      }> = [];
      for (const def of activeDefs) {
        const primarySig = extractSignal(log, def.key, axis);
        if (!primarySig || primarySig.length === 0) continue;
        const primaryPsd = computePsd(primarySig, primaryRate, { windowSize });
        if (primaryPsd.numWindows === 0) continue;

        // Per-log PSDs aligned to the primary's frequency grid. We keep the
        // full PsdResult (numWindows + dB) so we can do a weighted Welch-style
        // merge if the user toggled "Merge logs".
        const perLogPsds: Array<{ slot: LogSlot; dash: number[]; psd: PsdResult }> = [
          { slot: entries[0]!.slot, dash: entries[0]!.dash, psd: primaryPsd },
        ];
        for (let li = 1; li < entries.length; li++) {
          const e = entries[li]!;
          const sig = extractSignal(e.log, def.key, axis);
          if (!sig || sig.length === 0) continue;
          const psd = computePsd(sig, e.log.setup.sampleRateHz, { windowSize });
          if (psd.numWindows === 0) continue;
          const resampled = resampleY(psd.frequencies, psd.psdDb, primaryPsd.frequencies);
          perLogPsds.push({
            slot: e.slot,
            dash: e.dash,
            psd: { frequencies: primaryPsd.frequencies, psdDb: resampled, numWindows: psd.numWindows },
          });
        }

        if (effectiveMerge) {
          const merged = combinePsds(perLogPsds.map((p) => p.psd));
          items.push({
            def,
            freq: primaryPsd.frequencies,
            perLog: [{ slot: makeMergedSlot(entries), dash: [], psd: merged.psdDb }],
          });
        } else {
          items.push({
            def,
            freq: primaryPsd.frequencies,
            perLog: perLogPsds.map(({ slot, dash, psd }) => ({ slot, dash, psd: psd.psdDb })),
          });
        }
      }
      return items;
    });
  }, [log, entries, activeDefs, windowSize, effectiveMerge]);

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

      <div className="signal-grid">
        {SIGNAL_DEFS.map((def) => {
          const present = availability[def.key];
          const checked = multi ? singleSelected === def.key : selected.has(def.key);
          return (
            <label
              key={def.key}
              className={`signal-chip${checked ? ' signal-chip--on' : ''}${present ? '' : ' signal-chip--off'}`}
            >
              <input
                type={multi ? 'radio' : 'checkbox'}
                name={multi ? 'fs-signal' : undefined}
                checked={checked}
                disabled={!present}
                onChange={() => (multi ? pickSingle(def.key) : toggle(def.key))}
              />
              <span className="signal-chip__swatch" style={{ background: def.color || '#888' }} />
              {def.label}
              {!present && <span className="signal-chip__note">(not logged)</span>}
            </label>
          );
        })}
      </div>
      {multi && (
        <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.82rem' }}>
          Multi-log mode: pick one signal — each log will be drawn in its sidebar color.
        </p>
      )}

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
            type="number"
            step="5"
            value={yMin}
            onChange={(e) => setYMin(Number.parseFloat(e.target.value))}
            style={{ width: '4.5rem' }}
          />
        </label>
        <label>
          Y max:
          <input
            type="number"
            step="5"
            value={yMax}
            onChange={(e) => setYMax(Number.parseFloat(e.target.value))}
            style={{ width: '4.5rem' }}
          />
        </label>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      <div className="rpm-markers">
        <span className="rpm-markers__title">RPM markers:</span>
        {!hasRpm ? (
          <span className="muted">No eRPM telemetry in this log (needs BiDirectional DSHOT).</span>
        ) : (
          <>
            {perMotor.map(({ index, meanHz }) => {
              const checked = enabledMotors.has(index);
              const color = MOTOR_COLORS[index % MOTOR_COLORS.length]!;
              return (
                <label key={index} className={`rpm-motor${checked ? ' rpm-motor--on' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleMotor(index)} />
                  <span className="signal-chip__swatch" style={{ background: color }} />M{index + 1}
                  {meanHz != null && <span className="rpm-motor__hz">{meanHz.toFixed(0)} Hz</span>}
                </label>
              );
            })}
            <label>
              Pole pairs:
              <input
                type="number"
                min={1}
                max={20}
                step="1"
                value={polePairs}
                onChange={(e) => setPolePairs(Math.max(1, Number.parseInt(e.target.value || '7', 10)))}
                style={{ width: '3.5rem' }}
              />
            </label>
            <label>
              Blades:
              <input
                type="number"
                min={1}
                max={6}
                step="1"
                value={blades}
                onChange={(e) => setBlades(Math.max(1, Number.parseInt(e.target.value || '2', 10)))}
                style={{ width: '3.5rem' }}
              />
            </label>
            <label>
              Harmonics:
              <input
                type="number"
                min={1}
                max={6}
                step="1"
                value={harmonics}
                onChange={(e) => setHarmonics(Math.max(1, Number.parseInt(e.target.value || '3', 10)))}
                style={{ width: '3.5rem' }}
              />
            </label>
          </>
        )}
      </div>

      {dynNotchHz.length > 0 && (
        <div className="rpm-markers">
          <label className={`rpm-motor${showDynNotches ? ' rpm-motor--on' : ''}`}>
            <input type="checkbox" checked={showDynNotches} onChange={(e) => setShowDynNotches(e.target.checked)} />
            <span className="signal-chip__swatch" style={{ background: DYN_NOTCH_COLOR }} />
            Dynamic notches
          </label>
          <span className="muted">
            median {dynNotchHz.map((hz) => `${hz.toFixed(0)} Hz`).join(' · ')} (from FFT_FREQ debug)
          </span>
        </div>
      )}

      {harmonicNoise && (
        <details className="harmonic-noise" open>
          <summary>Noise at motor harmonics</summary>
          <p className="muted" style={{ fontSize: '0.78rem' }}>
            Peak noise within ±20 Hz of each multiple of motor speed (mean ± SD over the flight, takeoff to landing),
            and how much the gyro filters remove there. Uses {polePairs} pole pairs.
          </p>
          <MotorHarmonicTable axes={harmonicNoise} />
        </details>
      )}

      {!freqVec ? (
        <p className="muted">No selected signals are present in this window. Pick at least one from above.</p>
      ) : (
        AXIS_NAMES.map((name, axis) => {
          const items = psdByAxis[axis]!;
          if (items.length === 0) {
            return (
              <div key={name} className="axis-plot">
                <h3 className="axis-plot__title">
                  <span className="axis-plot__dot" style={{ background: AXIS_COLORS[axis] }} />
                  {name}
                </h3>
                <p className="muted">No data for selected signals on this axis.</p>
              </div>
            );
          }
          const series: PlotSeries[] = [];
          for (const { def, perLog } of items) {
            for (const { slot, psd } of perLog) {
              if (multi) {
                // Color per log.
                series.push({
                  label: shortName(slot),
                  values: psd,
                  stroke: colorFor(slot),
                  width: 1.4,
                });
              } else {
                // Signal-color overlay (axis color for gyro filt, def color otherwise).
                const color = def.key === 'gyroFilt' ? AXIS_COLORS[axis]! : def.color;
                series.push({
                  label: def.label,
                  values: psd,
                  stroke: color,
                  width: 1,
                });
              }
            }
          }
          const freq = items[0]!.freq;
          return (
            <div key={name} className="axis-plot">
              <h3 className="axis-plot__title">
                <span className="axis-plot__dot" style={{ background: AXIS_COLORS[axis] }} />
                {name}
              </h3>
              <div className="psd-grid">
                <TimeSeriesPlot
                  time={freq}
                  series={series}
                  yLabel="dB"
                  xLabel="Hz"
                  xMin={0}
                  xMax={nyquist}
                  yMin={yMin}
                  yMax={yMax}
                  markers={rpmMarkers}
                  height={220}
                />
                <TimeSeriesPlot
                  time={freq}
                  series={series}
                  yLabel="dB"
                  xLabel="Hz (sub-100)"
                  xMin={0}
                  xMax={100}
                  yMin={yMin}
                  yMax={yMax}
                  markers={rpmMarkers}
                  height={220}
                />
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
