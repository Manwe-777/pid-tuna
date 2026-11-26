import { useMemo, useState } from 'react';
import { filterTestSignal } from '../../dsp/filters/filterTestSignal';
import type { FilterSpec, TestSignalKind } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { Field } from './Field';

const NOISE_LEVELS = [
  { label: 'none', value: 0 },
  { label: 'low', value: 0.1 },
  { label: 'medium', value: 0.3 },
  { label: 'high', value: 0.6 },
];

/** The chain's response to a step, an impulse or a chirp, at the gyro loop rate. */
export function TestSignalPlot({
  chain,
  loopHz,
  inputColor,
  outputColor,
}: {
  chain: FilterSpec[];
  loopHz: number;
  inputColor: string;
  outputColor: string;
}) {
  const [kind, setKind] = useState<TestSignalKind>('step');
  const [startHz, setStartHz] = useState(0);
  const [endHz, setEndHz] = useState(Math.min(1000, Math.floor(loopHz / 2)));
  const [duration, setDuration] = useState(1);
  const [noise, setNoise] = useState(0);
  const [windowMs, setWindowMs] = useState(20);

  const result = useMemo(
    () => filterTestSignal(chain, loopHz, kind, { startHz, endHz: Math.max(endHz, startHz + 1), duration, noise }),
    [chain, loopHz, kind, startHz, endHz, duration, noise],
  );

  return (
    <div className="axis-plot">
      <h3 className="axis-plot__title">Test signal</h3>
      <div className="controls">
        <label>
          Signal
          <select value={kind} onChange={(e) => setKind(e.target.value as TestSignalKind)}>
            <option value="step">Step</option>
            <option value="impulse">Impulse</option>
            <option value="chirp">Chirp</option>
          </select>
        </label>
        {kind === 'chirp' ? (
          <>
            <Field label="From" unit="Hz" value={startHz} onChange={setStartHz} />
            <Field label="to" unit="Hz" value={endHz} onChange={setEndHz} />
            <Field
              label="Over"
              unit="s"
              value={duration}
              step={0.1}
              onChange={(v) => setDuration(Math.min(2, Math.max(0.05, v)))}
            />
            <label>
              Noise
              <select value={noise} onChange={(e) => setNoise(Number.parseFloat(e.target.value))}>
                {NOISE_LEVELS.map((n) => (
                  <option key={n.label} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <Field label="Show" unit="ms" value={windowMs} onChange={(v) => setWindowMs(Math.min(500, Math.max(1, v)))} />
        )}
      </div>
      <TimeSeriesPlot
        time={result.timeMs}
        series={[
          { label: 'Input', values: result.input, stroke: inputColor, width: 1 },
          { label: 'Through the chain', values: result.output, stroke: outputColor, width: 1.5 },
        ]}
        xLabel="ms"
        xMin={0}
        xMax={kind === 'chirp' ? duration * 1000 : windowMs}
        height={200}
      />
    </div>
  );
}
