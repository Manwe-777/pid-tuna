import { useEffect, useMemo, useState } from 'react';
import { ALL_AXIS, AXIS_COLORS, AXIS_NAMES, HEATMAP_HEIGHT, SPECTRAL_MODES, WINDOW_SIZES } from '../../constants';
import { computeErrorSetpointDensity } from '../../dsp/errorSetpoint';
import { latencyForLog } from '../../dsp/latencyForLog';
import { motorRpmSeries, rpmAxisMax, throttlePercentSeries } from '../../dsp/spectralDomains';
import { computeBinnedSpectrogram, computeSpectrogram } from '../../dsp/spectrogram';
import { stepResponseMask } from '../../dsp/stepResponseMask';
import { shortName } from '../../logs/shortName';
import type { LogEntry, SpectralMode, SpectrogramSource } from '../../types';
import { combineAxisPowerDb } from '../../utils/combineAxisPowerDb';
import { isBinnedMode } from '../../utils/isBinnedMode';
import { isRpmMode } from '../../utils/isRpmMode';
import { isTimeMode } from '../../utils/isTimeMode';
import { modeValueKind } from '../../utils/modeValueKind';
import { robustPsdRange } from '../../utils/robustPsdRange';
import { BinnedSpecPlot } from './BinnedSpecPlot';
import { DensityPlot } from './DensityPlot';
import { SpectrogramPlot } from './SpectrogramPlot';
import { type PlotSeries, TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function SpectralSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const others = entries.slice(1);
  const rate = log.setup.sampleRateHz;
  const nyquist = Math.floor(rate / 2);

  const [mode, setMode] = useState<SpectralMode>('freqTime');
  const [axis, setAxis] = useState<number>(ALL_AXIS); // 0=Roll, 1=Pitch, 2=Yaw, 3=All
  const [windowSize, setWindowSize] = useState<number>(512);
  const [source, setSource] = useState<SpectrogramSource>('filt');
  const [maxFreq, setMaxFreq] = useState<number>(Math.min(500, nyquist));
  const [cursorTime, setCursorTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  // User overrides for the PSD colour scale (null = auto from data).
  const [dbMin, setDbMin] = useState<number | null>(null);
  const [dbMax, setDbMax] = useState<number | null>(null);

  const hasRaw = useMemo(() => log.gyroRaw.some((arr) => arr.some((v) => v !== 0)), [log]);
  const effectiveSource: SpectrogramSource = source === 'raw' && !hasRaw ? 'filt' : source;
  const valueMode = modeValueKind(mode);
  const timeMode = isTimeMode(mode);
  const binnedMode = isBinnedMode(mode);
  const rpmMode = isRpmMode(mode);

  // Motor-frequency (Hz) domain for RPM modes — null when no eRPM telemetry.
  const rpm = useMemo(() => motorRpmSeries(log), [log]);
  const rpmHz = useMemo(() => {
    if (!rpm) return null;
    const a = new Float32Array(rpm.length);
    for (let i = 0; i < rpm.length; i++) a[i] = rpm[i]! / 60;
    return a;
  }, [rpm]);
  const rpmHzMax = useMemo(() => (rpm ? rpmAxisMax(rpm) / 60 : 0), [rpm]);

  const signalFor = (i: number) => (effectiveSource === 'raw' ? log.gyroRaw[i]! : log.gyroFilt[i]!);
  const isAll = axis === ALL_AXIS;
  const [compensateLag, setCompensateLag] = useState(true);
  const axisName = isAll ? 'All axes' : AXIS_NAMES[axis]!;
  const axisColor = isAll ? '#aab4c4' : AXIS_COLORS[axis]!;

  // Time-domain spectrogram for the selected axis (Frequency / PSD).
  const spec = useMemo(() => {
    if (!timeMode) return null;
    const hopSize = Math.max(1, Math.min(windowSize >> 1, Math.round(rate * 0.015)));
    if (isAll) {
      const per = [0, 1, 2].map((i) => computeSpectrogram(signalFor(i), rate, { windowSize, hopSize, mode: 'psd' }));
      return {
        ...per[0]!,
        magnitudes: combineAxisPowerDb(
          per.map((p) => p.magnitudes),
          valueMode,
        ),
        valueMode,
      };
    }
    return computeSpectrogram(signalFor(axis), rate, { windowSize, hopSize, mode: valueMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, windowSize, effectiveSource, mode, axis]);

  // Binned spectrogram (vs Throttle / vs RPM) for the selected axis.
  const binned = useMemo(() => {
    if (!binnedMode) return null;
    const domainSig = rpmMode ? rpmHz : throttlePercentSeries(log);
    if (!domainSig) return null; // RPM mode without telemetry
    const domainMax = rpmMode ? rpmHzMax : 100;
    if (isAll) {
      const per = [0, 1, 2].map((i) =>
        computeBinnedSpectrogram(signalFor(i), domainSig, rate, { mode: 'psd', domainMin: 0, domainMax }),
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
    return computeBinnedSpectrogram(signalFor(axis), domainSig, rate, {
      mode: valueMode,
      domainMin: 0,
      domainMax,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, mode, axis, effectiveSource, rpmHz, rpmHzMax]);

  // Error-vs-setpoint density (always filtered gyro). "All" pools every axis'
  // samples into one density over a shared range.
  const density = useMemo(() => {
    if (mode !== 'errorSetpoint') return null;
    const mask = stepResponseMask(log, { flightOnly: true });
    const input = (a: number) => ({
      setpoint: log.setpoint[a]!,
      gyro: log.gyroFilt[a]!,
      mask,
      lagSamples: compensateLag ? (latencyForLog(log, a).lagMs / 1000) * log.setup.sampleRateHz : 0,
    });
    return computeErrorSetpointDensity(isAll ? [0, 1, 2].map(input) : input(axis));
  }, [log, mode, axis, isAll, compensateLag]);

  // PSD colour scale: robust auto default, overridable by the dB inputs.
  const autoRange = useMemo(() => {
    if (valueMode !== 'psd') return { floor: -80, ceil: 0 };
    const arrs: Float32Array[] = [];
    if (spec) arrs.push(spec.magnitudes);
    if (binned) arrs.push(binned.magnitudes);
    return robustPsdRange(arrs);
  }, [valueMode, spec, binned]);
  const floorDb = valueMode === 'psd' ? (dbMin ?? autoRange.floor) : -80;
  const ceilDb = valueMode === 'psd' ? (dbMax ?? autoRange.ceil) : 0;

  // --- time cursor / playback (time modes only) -------------------------
  const times = spec?.times ?? null;
  const tMin = times && times.length > 0 ? times[0]! : 0;
  const tMax = times && times.length > 0 ? times[times.length - 1]! : 0;

  useEffect(() => {
    if (cursorTime == null && times && times.length > 0) setCursorTime((tMin + tMax) / 2);
    if (cursorTime != null && (cursorTime < tMin || cursorTime > tMax)) {
      setCursorTime(times && times.length > 0 ? (tMin + tMax) / 2 : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax]);

  useEffect(() => {
    if (!isPlaying || cursorTime == null || tMax <= tMin) return;
    let raf = 0;
    let lastWall = performance.now();
    let t = cursorTime;
    const tick = (now: number) => {
      const dt = (now - lastWall) / 1000;
      lastWall = now;
      t += dt * playSpeed;
      if (t > tMax) t = tMin + (t - tMax);
      setCursorTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playSpeed, tMin, tMax]);

  const slice = useMemo(() => {
    if (!spec || cursorTime == null || !times || times.length === 0) return null;
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid]! < cursorTime) lo = mid + 1;
      else hi = mid;
    }
    let bin = lo;
    if (bin > 0 && Math.abs(times[bin - 1]! - cursorTime) < Math.abs(times[bin]! - cursorTime)) bin -= 1;
    const fb = spec.freqBins;
    const values = new Float32Array(fb);
    const base = bin * fb;
    for (let f = 0; f < fb; f++) values[f] = spec.magnitudes[base + f]!;
    return { freq: spec.frequencies, values };
  }, [spec, cursorTime, times]);

  const sliceSeries: PlotSeries[] = slice
    ? [{ label: axisName, values: slice.values, stroke: axisColor, width: 1.4 }]
    : [];

  const modeLabel = SPECTRAL_MODES.find((m) => m.id === mode)?.label ?? '';
  const rpmUnavailable = rpmMode && !rpm;
  const showDbControls = valueMode === 'psd' && !rpmUnavailable;

  return (
    <section className="plot-section">
      <h2>
        Spectral · {modeLabel}
        {others.length > 0 && ` — showing ${shortName(entries[0]!.slot)} only`}
      </h2>
      {others.length > 0 && (
        <p className="muted">
          Heatmaps can&apos;t overlay — showing the first enabled log only. Use the Full spectrum tab to compare logs as
          line traces.
        </p>
      )}

      <div className="controls">
        <label>
          Mode:
          <select value={mode} onChange={(e) => setMode(e.target.value as SpectralMode)}>
            {SPECTRAL_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Axis:
          <select value={axis} onChange={(e) => setAxis(Number.parseInt(e.target.value, 10))}>
            <option value={ALL_AXIS}>All axes</option>
            {AXIS_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {mode !== 'errorSetpoint' && (
          <label>
            Signal:
            <select
              value={effectiveSource}
              onChange={(e) => setSource(e.target.value as SpectrogramSource)}
              disabled={!hasRaw}
            >
              <option value="filt">Filtered (gyroADC)</option>
              <option value="raw" disabled={!hasRaw}>
                Raw (gyroUnfilt){hasRaw ? '' : ' — not logged'}
              </option>
            </select>
          </label>
        )}
        {timeMode && (
          <label>
            Window:
            <select value={windowSize} onChange={(e) => setWindowSize(Number.parseInt(e.target.value, 10))}>
              {WINDOW_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode !== 'errorSetpoint' && (
          <label>
            Max freq:
            <select value={maxFreq} onChange={(e) => setMaxFreq(Number.parseInt(e.target.value, 10))}>
              {[250, 500, 750, 1000, nyquist]
                .filter((v, i, a) => v <= nyquist && a.indexOf(v) === i)
                .map((v) => (
                  <option key={v} value={v}>
                    {v} Hz
                  </option>
                ))}
            </select>
          </label>
        )}
        {showDbControls && (
          <>
            <label>
              Min dB:
              <input
                type="number"
                step={5}
                value={floorDb}
                onChange={(e) => setDbMin(Number.parseInt(e.target.value, 10))}
                className="spec-db-input"
              />
            </label>
            <label>
              Max dB:
              <input
                type="number"
                step={5}
                value={ceilDb}
                onChange={(e) => setDbMax(Number.parseInt(e.target.value, 10))}
                className="spec-db-input"
              />
            </label>
            {(dbMin != null || dbMax != null) && (
              <button
                type="button"
                className="step-btn-reset"
                onClick={() => {
                  setDbMin(null);
                  setDbMax(null);
                }}
              >
                Auto
              </button>
            )}
          </>
        )}
      </div>

      {mode === 'errorSetpoint' && (
        <>
          <p className="muted">
            Tracking-error density, takeoff to landing: error = setpoint − gyro (deg/s) against commanded setpoint. The
            orange line is the mean error at each setpoint. A cloud centred on the dashed error = 0 line means gyro
            reaches setpoint; a line tilting up to the right means it falls short at high rates. With latency
            compensated, the stick-to-gyro delay is taken out first, so what remains is tracking, not lag.
          </p>
          <div className="controls">
            <label title="Compare setpoint with gyro shifted back by the measured tracking latency">
              <input type="checkbox" checked={compensateLag} onChange={(e) => setCompensateLag(e.target.checked)} />
              Compensate latency
            </label>
            {density && density.rmsError != null && (
              <span className="muted">
                RMS error {density.rmsError.toFixed(1)} deg/s
                {density.trackingSlope != null &&
                  ` · over the whole flight gyro averages ${((1 - density.trackingSlope) * 100).toFixed(0)}% of setpoint (slope ${density.trackingSlope.toFixed(3)}; the Step response "level" is the shorter 200–500 ms view)`}
              </span>
            )}
          </div>
        </>
      )}
      {binnedMode && !rpmUnavailable && (
        <p className="muted">
          {rpmMode
            ? 'Gyro spectrum (X) binned by mean motor rotation frequency (Y, from eRPM telemetry). Diagonal streaks are RPM-tracking noise and its harmonics; the RPM/Hz axis is approximate.'
            : 'Gyro spectrum (X) binned by throttle (Y) — vertical streaks reveal throttle/RPM-correlated motor noise.'}
        </p>
      )}
      {rpmUnavailable && (
        <p className="muted">
          This mode needs eRPM telemetry (BiDirectional DSHOT), which isn&apos;t present in this log.
        </p>
      )}

      {timeMode && times && times.length > 0 && (
        <div className="spec-playback">
          <button type="button" className="spec-playback__btn" onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={tMin}
            max={tMax}
            step={(tMax - tMin) / 2000}
            value={cursorTime ?? tMin}
            onChange={(e) => {
              setIsPlaying(false);
              setCursorTime(Number.parseFloat(e.target.value));
            }}
            className="spec-playback__slider"
          />
          <span className="spec-playback__time">
            {cursorTime != null ? `${cursorTime.toFixed(2)} s` : '—'}
            <span className="muted">{` / ${tMax.toFixed(2)} s`}</span>
          </span>
          <label className="spec-playback__speed">
            Speed:
            <select value={playSpeed} onChange={(e) => setPlaySpeed(Number.parseFloat(e.target.value))}>
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      )}

      {timeMode && slice && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h3 className="axis-plot__title">
            Spectral slice at {cursorTime != null ? `${cursorTime.toFixed(2)} s` : '—'}
          </h3>
          <TimeSeriesPlot
            time={slice.freq}
            series={sliceSeries}
            yLabel="dB"
            xLabel="Hz"
            xMin={0}
            xMax={maxFreq}
            yMin={floorDb}
            yMax={ceilDb}
            height={180}
          />
        </div>
      )}

      {timeMode && spec && (
        <SpectrogramPlot
          data={spec}
          title={axisName}
          maxFreqHz={maxFreq}
          floorDb={floorDb}
          ceilDb={ceilDb}
          cursorTime={cursorTime ?? undefined}
          height={HEATMAP_HEIGHT}
        />
      )}

      {binnedMode && !rpmUnavailable && binned && (
        <BinnedSpecPlot
          data={binned}
          title={axisName}
          yLabel={rpmMode ? 'motor freq (Hz)' : 'throttle %'}
          maxFreqHz={maxFreq}
          dbFloor={floorDb}
          dbCeil={ceilDb}
          valueUnit={valueMode === 'psd' ? 'dBm/Hz' : 'dB'}
          height={HEATMAP_HEIGHT}
        />
      )}

      {mode === 'errorSetpoint' && density && <DensityPlot data={density} title={axisName} height={HEATMAP_HEIGHT} />}
    </section>
  );
}
