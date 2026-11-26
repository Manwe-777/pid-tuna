import { useMemo, useState } from 'react';

import {
  AXIS_COLORS,
  AXIS_NAMES,
  DEFAULT_FILTER_SPECS,
  DELAY_REFERENCE_HZ,
  PSD_WINDOW_SIZES,
  SIM_FILTERED_COLOR,
  SIM_ORIGINAL_COLOR,
} from '../../constants';
import { applyFilterChain } from '../../dsp/filters/applyFilterChain';
import { computeFilterChainResponse } from '../../dsp/filters/computeFilterChainResponse';
import { gyroChainFromTune } from '../../dsp/filters/gyroChainFromTune';
import { newFilterId } from '../../dsp/filters/newFilterId';
import { computePsd } from '../../dsp/spectrum/computePsd';
import { medianMotorHz } from '../../dsp/spectrum/medianMotorHz';
import { buildTuneView } from '../../tune/buildTuneView';
import type { FilterSpec, FilterType, LogEntry, PlotSeries } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { FilterRow } from './FilterRow';
import { TestSignalPlot } from './TestSignalPlot';

export function FilterSimulatorSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const tune = useMemo(() => buildTuneView(log), [log]);
  const gyroRateHz = tune.gyroRateHz ?? log.setup.sampleRateHz;
  const [chain, setChain] = useState<FilterSpec[]>([]);
  const [windowSize, setWindowSize] = useState<number>(1024);
  const [yMin, setYMin] = useState<number>(-50);
  const [yMax, setYMax] = useState<number>(20);
  const [delayHz, setDelayHz] = useState<number>(DELAY_REFERENCE_HZ);

  const addFilter = (type: FilterType) => {
    setChain((prev) => [...prev, { ...DEFAULT_FILTER_SPECS[type], id: newFilterId() }]);
  };

  const removeFilter = (id: string) => {
    setChain((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, patch: Partial<FilterSpec>) => {
    setChain((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const hasRaw = useMemo(() => log.gyroRaw.some((arr) => arr.some((v) => v !== 0)), [log]);

  // Bode response of the active chain — independent of the log's signal.
  const bode = useMemo(() => {
    const N = 256;
    const freqs = new Float32Array(N);
    const fStep = nyquist / (N - 1 || 1);
    for (let i = 0; i < N; i++) freqs[i] = i * fStep;
    return computeFilterChainResponse(chain, gyroRateHz, freqs);
  }, [chain, gyroRateHz, nyquist]);

  const controlDelayMs = useMemo(
    () => computeFilterChainResponse(chain, gyroRateHz, Float32Array.of(delayHz)).phaseDelayMs[0] ?? null,
    [chain, gyroRateHz, delayHz],
  );

  const psdByAxis = useMemo(() => {
    const rate = log.setup.sampleRateHz;
    return AXIS_NAMES.map((_name, axis) => {
      const raw = log.gyroRaw[axis]!;
      const filt = log.gyroFilt[axis]!;
      if (!hasRaw || raw.length === 0) return null;
      const sim = applyFilterChain(raw, rate, chain);
      const rawPsd = computePsd(raw, rate, { windowSize });
      const simPsd = computePsd(sim, rate, { windowSize });
      const filtPsd = computePsd(filt, rate, { windowSize });
      return { rawPsd, simPsd, filtPsd };
    });
  }, [log, chain, windowSize, hasRaw]);

  if (!hasRaw) {
    return (
      <section className="plot-section">
        <h2>Filter simulator</h2>
        <p className="muted">Needs raw gyro (`gyroUnfilt`) to simulate filtering. Not present in this log.</p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Filter simulator</h2>
      <p className="muted">
        Apply a filter chain to the unfiltered gyro and compare it with the firmware&apos;s filtered gyro. Filters use
        Betaflight&apos;s own maths. The response curves run at the gyro loop rate ({Math.round(gyroRateHz)} Hz); the
        simulated spectrum can only run at the logging rate ({Math.round(log.setup.sampleRateHz)} Hz), so it is
        approximate near the top of the plot.
      </p>

      <div className="filter-chain">
        {chain.length === 0 && <span className="muted">Empty — add a filter to start.</span>}
        {chain.map((f) => (
          <FilterRow
            key={f.id}
            filter={f}
            maxHz={Math.floor(gyroRateHz / 2)}
            onChange={(patch) => updateFilter(f.id, patch)}
            onRemove={() => removeFilter(f.id)}
          />
        ))}
        <div className="filter-add">
          <button type="button" className="btn btn--sm" onClick={() => addFilter('pt1')}>
            + PT1
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('pt2')}>
            + PT2
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('pt3')}>
            + PT3
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('biquad')}>
            + Biquad
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('notch')}>
            + Notch
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('rpm')}>
            + RPM filter
          </button>
          <button type="button" className="btn btn--sm" onClick={() => addFilter('dynNotch')}>
            + Dynamic notch
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() =>
              setChain(
                gyroChainFromTune(tune, { motorHz: medianMotorHz(log), motorCount: log.motor.length || undefined }),
              )
            }
            data-tip="Replace the chain with this log's gyro filters: a dynamic lowpass at its minimum cutoff, RPM notches at the median motor frequency, dynamic notches at their minimum"
          >
            Load from log
          </button>
        </div>
      </div>

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
        <label data-tip="Frequency the chain's delay is reported at">
          Delay at:
          <input
            className="w-16"
            type="number"
            min={1}
            max={200}
            step="1"
            value={delayHz}
            onChange={(e) =>
              setDelayHz(Math.min(200, Math.max(1, Number.parseFloat(e.target.value) || DELAY_REFERENCE_HZ)))
            }
          />
          <span className="muted">Hz</span>
        </label>
      </div>

      {bode.hasFilters && (
        <div className="axis-plot">
          <h3 className="axis-plot__title">
            Filter response (chain)
            {controlDelayMs != null && (
              <span className="step-metrics">
                <span className="step-metrics__item">
                  <span className="step-metrics__k">delay @{delayHz} Hz</span>
                  {controlDelayMs.toFixed(2)} ms · {((controlDelayMs / 1000) * 360 * delayHz).toFixed(1)}° lag
                </span>
              </span>
            )}
          </h3>
          <div className="psd-grid">
            <TimeSeriesPlot
              time={bode.frequencies}
              series={[
                {
                  label: 'Gain',
                  values: bode.magnitudeDb,
                  stroke: SIM_FILTERED_COLOR,
                  width: 1.5,
                },
              ]}
              yLabel="dB"
              xLabel="Hz"
              xMin={0}
              xMax={nyquist}
              yMin={-60}
              yMax={6}
              height={180}
              showLegend={false}
            />
            <TimeSeriesPlot
              time={bode.frequencies}
              series={[
                {
                  label: 'Phase delay',
                  values: bode.phaseDelayMs,
                  stroke: SIM_FILTERED_COLOR,
                  width: 1.5,
                },
              ]}
              yLabel="ms"
              xLabel="Hz"
              xMin={0}
              xMax={nyquist}
              height={180}
              showLegend={false}
            />
          </div>
        </div>
      )}

      {bode.hasFilters && (
        <TestSignalPlot
          chain={chain}
          loopHz={gyroRateHz}
          inputColor={SIM_ORIGINAL_COLOR}
          outputColor={SIM_FILTERED_COLOR}
        />
      )}

      {AXIS_NAMES.map((name, axis) => {
        const psd = psdByAxis[axis];

        if (!psd) {
          return (
            <div key={name} className="axis-plot">
              <h3 className="axis-plot__title">
                <span className="axis-plot__dot" style={{ background: AXIS_COLORS[axis] }} />
                {name}
              </h3>
              <p className="muted">No raw gyro for this axis.</p>
            </div>
          );
        }

        const series: PlotSeries[] = [
          { label: 'Gyro prefilt', values: psd.rawPsd.psdDb, stroke: SIM_ORIGINAL_COLOR, width: 1 },
          {
            label: 'Simulated (your chain)',
            values: psd.simPsd.psdDb,
            stroke: SIM_FILTERED_COLOR,
            width: 1.5,
          },
          { label: 'BF gyro filt (current)', values: psd.filtPsd.psdDb, stroke: AXIS_COLORS[axis]!, width: 1 },
        ];
        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[axis] }} />
              {name}
            </h3>
            <TimeSeriesPlot
              time={psd.rawPsd.frequencies}
              series={series}
              yLabel="dB"
              xLabel="Hz"
              xMin={0}
              xMax={nyquist}
              yMin={yMin}
              yMax={yMax}
              height={240}
            />
          </div>
        );
      })}
    </section>
  );
}
