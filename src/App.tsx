import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GpsMapTrack } from './components/GpsMapTrack';
import { LogDotPlot, type LogDot } from './components/LogDotPlot';
import { Sidebar } from './components/Sidebar';
import { SpectrogramPlot } from './components/SpectrogramPlot';
import { ThrottleSpecPlot } from './components/ThrottleSpecPlot';
import { TimeRangeControl } from './components/TimeRangeControl';
import { TimeSeriesPlot, type PlotBand, type PlotMarker, type PlotSeries } from './components/TimeSeriesPlot';
import { TuneSettingsPanel } from './components/TuneSettingsPanel';
import { AXIS_COLORS, AXIS_NAMES } from './axes';
import {
  colorFor,
  DASH_PATTERNS,
  enabledLogs,
  newSlotId,
  shortName,
  type LogEntry,
  type LogSlot,
} from './logs';
import {
  applyFilterChain,
  computeFilterChainResponse,
  DEFAULT_FILTER_SPECS,
  newFilterId,
  type FilterSpec,
  type FilterType,
} from './dsp/filters';
import {
  computeFilterDelays,
  computeXcorrLatency,
  type FilterDelayEntry,
  type LatencyResult,
} from './dsp/latency';
import { analyzeBattery, type BatteryAnalysis } from './dsp/battery';
import { analyzeGps, type GpsAnalysis } from './dsp/gps';
import { buildValidGpsSamples } from './dsp/gpsPlayback';
import { gpsAltitudeViridisSegments } from './dsp/gpsViridis';
import { gpsViewerEffectiveRange } from './dsp/gpsWindow';
import {
  analyzeMotorBalance,
  combineMotorBalances,
  type AxisImbalance,
  type BalanceAnalysis,
} from './dsp/motorBalance';
import { analyzeSaturation, type SaturationAnalysis } from './dsp/saturation';
import { buildMergedScorecard, buildScorecard, type ScoreEntry, type ScoreStatus } from './dsp/scorecard';
import {
  combinePsds,
  computePsd,
  computeSpectrogram,
  computeThrottleSpectrogram,
  type PsdResult,
} from './dsp/spectrogram';
import { combineStepResponses, computeStepResponse } from './dsp/stepResponse';
import { parseLog } from './parser';
import { sliceLog, type TimeRangeSec } from './sliceLog';
import { buildTuneView } from './tuneView';
import type { ParsedLog } from './types';


export function App() {
  const [slots, setSlots] = useState<LogSlot[]>([]);

  const updateSlot = useCallback((id: string, patch: Partial<LogSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addFile = useCallback(
    async (file: File) => {
      const id = newSlotId();
      // Assign next dash pattern index — count of existing slots (cycles via DASH_PATTERNS).
      setSlots((prev) => [
        ...prev,
        {
          id,
          enabled: true,
          dashIndex: prev.length,
          state: { kind: 'parsing', fileName: file.name, progress: 0, rows: 0 },
        },
      ]);
      try {
        const log = await parseLog(file, {
          onProgress: ({ progress, rows }) =>
            setSlots((prev) =>
              prev.map((s) =>
                s.id === id
                  ? { ...s, state: { kind: 'parsing', fileName: file.name, progress, rows } }
                  : s,
              ),
            ),
        });
        setSlots((prev) =>
          prev.map((s) => (s.id === id ? { ...s, state: { kind: 'ready', log } } : s)),
        );
      } catch (err) {
        setSlots((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  state: {
                    kind: 'error',
                    fileName: file.name,
                    message: err instanceof Error ? err.message : String(err),
                  },
                }
              : s,
          ),
        );
      }
    },
    [],
  );

  const toggleSlot = useCallback(
    (id: string) => {
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
    },
    [],
  );

  const removeSlot = useCallback((id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderSlots = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.id === fromId);
      const to = prev.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  void updateSlot;

  const enabled = useMemo(() => enabledLogs(slots), [slots]);

  return (
    <>
      <header className="app-header">
        <span className="app-header__title">PIDTuna</span>
      </header>
      <div className="app-shell">
        <Sidebar
          slots={slots}
          onAddFile={addFile}
          onToggle={toggleSlot}
          onRemove={removeSlot}
          onReorder={reorderSlots}
        />
        <main className="app">
          {enabled.length > 0 ? (
            <Analyses enabled={enabled} />
          ) : (
            <p className="muted">
              Load a log in the sidebar and enable it to begin. Loaded logs can be toggled on/off to compare them.
            </p>
          )}
        </main>
      </div>
    </>
  );
}

type TabId =
  | 'scorecard'
  | 'tracking'
  | 'filtering'
  | 'pid'
  | 'saturation'
  | 'motors'
  | 'balance'
  | 'battery'
  | 'gps'
  | 'step'
  | 'latency'
  | 'spectrum'
  | 'filterSim'
  | 'spectrogram'
  | 'throttle'
  | 'settings'
  | 'diff';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'filtering', label: 'Raw vs filt' },
  { id: 'pid', label: 'PID terms' },
  { id: 'saturation', label: 'I-term sat' },
  { id: 'motors', label: 'Motors' },
  { id: 'balance', label: 'Balance' },
  { id: 'battery', label: 'Battery' },
  { id: 'gps', label: 'GPS' },
  { id: 'step', label: 'Step response' },
  { id: 'latency', label: 'Latency' },
  { id: 'spectrum', label: 'Full spectrum' },
  { id: 'filterSim', label: 'Filter sim' },
  { id: 'spectrogram', label: 'Spectrogram' },
  { id: 'throttle', label: 'Throttle spec' },
  { id: 'settings', label: 'Tune settings' },
  { id: 'diff', label: 'Diff' },
];

/**
 * Whether the loaded logs collectively contain the data each tab needs. A tab
 * is enabled if *any* loaded log has the required data; tabs whose data is
 * missing from every log get a dot and are non-clickable.
 */
function tabHasData(tabId: TabId, entries: LogEntry[]): boolean {
  const some = (pick: (p: ParsedLog['presence']) => boolean) =>
    entries.some((e) => pick(e.log.presence));
  switch (tabId) {
    case 'filtering':
    case 'filterSim':
      return some((p) => p.gyroRaw);
    case 'pid':
      return some((p) => p.pidTerms);
    case 'saturation':
      return some((p) => p.iTerm);
    case 'motors':
    case 'balance':
    case 'throttle':
      return some((p) => p.motors);
    case 'battery':
      return some((p) => p.vbat || p.amperage);
    case 'gps':
      return some((p) => p.gps);
    default:
      return true;
  }
}

function TabBar({
  active,
  onChange,
  disabled,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  disabled: ReadonlySet<TabId>;
}) {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => {
        const isDisabled = disabled.has(t.id);
        const cls = [
          'tab-bar__tab',
          active === t.id ? 'tab-bar__tab--active' : '',
          isDisabled ? 'tab-bar__tab--empty' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={t.id}
            type="button"
            className={cls}
            onClick={() => !isDisabled && onChange(t.id)}
            disabled={isDisabled}
            title={isDisabled ? 'No data in the loaded log(s) for this tab' : undefined}
          >
            {t.label}
            {isDisabled && <span className="tab-bar__dot" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}

function Analyses({ enabled }: { enabled: Array<{ slot: LogSlot; log: ParsedLog }> }) {
  const duration = useMemo(
    () => Math.max(...enabled.map(({ log }) => log.time[log.time.length - 1] ?? 0), 0),
    [enabled],
  );
  const primaryId = enabled[0]?.slot.id ?? null;

  const [range, setRange] = useState<TimeRangeSec>(() => ({
    start: duration > 12 ? 5 : 0,
    end: duration > 12 ? duration - 5 : duration,
  }));

  useEffect(() => {
    setRange({
      start: duration > 12 ? 5 : 0,
      end: duration > 12 ? duration - 5 : duration,
    });
  }, [duration, primaryId]);

  const entries = useMemo<LogEntry[]>(
    () =>
      enabled.map(({ slot, log }) => ({
        slot,
        log: sliceLog(log, range),
        dash: [...(DASH_PATTERNS[slot.dashIndex % DASH_PATTERNS.length] ?? [])],
      })),
    [enabled, range],
  );

  const primary = entries[0]!;
  const empty = primary.log.time.length === 0;

  const [tab, setTab] = useState<TabId>('scorecard');

  const disabledTabs = useMemo(() => {
    const out = new Set<TabId>();
    for (const { id } of TABS) {
      if (!tabHasData(id, entries)) out.add(id);
    }
    return out;
  }, [entries]);

  // If the active tab loses its data (e.g. user switched to a log without GPS),
  // bounce back to the scorecard rather than rendering an empty section.
  useEffect(() => {
    if (disabledTabs.has(tab)) setTab('scorecard');
  }, [disabledTabs, tab]);

  return (
    <>
      <section className="window-controls">
        <TimeRangeControl max={duration} value={range} onChange={setRange} />
      </section>
      <TabBar active={tab} onChange={setTab} disabled={disabledTabs} />
      {empty ? (
        <p className="muted">Selected window contains no samples. Widen the range above.</p>
      ) : (
        <div className="tab-content">
          {tab === 'scorecard' && <ScorecardSection entries={entries} onJump={setTab} />}
          {tab === 'tracking' && <TrackingSection entries={entries} />}
          {tab === 'filtering' && <FilteringSection entries={entries} />}
          {tab === 'pid' && <PidTermsSection entries={entries} />}
          {tab === 'saturation' && <SaturationSection entries={entries} />}
          {tab === 'motors' && <MotorsSection entries={entries} />}
          {tab === 'balance' && <BalanceSection entries={entries} />}
          {tab === 'battery' && <BatterySection entries={entries} />}
          {tab === 'gps' && <GpsSection sources={enabled} windowRange={range} />}
          {tab === 'step' && <StepResponseSection entries={entries} />}
          {tab === 'latency' && <LatencySection entries={entries} />}
          {tab === 'spectrum' && <FullSpectrumSection entries={entries} />}
          {tab === 'filterSim' && <FilterSimulatorSection entries={entries} />}
          {tab === 'spectrogram' && <SpectrogramSection entries={entries} />}
          {tab === 'throttle' && <ThrottleSpectrogramSection entries={entries} />}
          {tab === 'settings' && <TuneSettingsPanel entries={entries} />}
          {tab === 'diff' && <DiffSummarySection entries={entries} />}
        </div>
      )}
    </>
  );
}

/* -------------------------- Filter simulator ----------------------- */

const SIM_ORIGINAL_COLOR = '#7a8597';
const SIM_FILTERED_COLOR = '#5fffe0';

function FilterSimulatorSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const multi = entries.length > 1;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const [chain, setChain] = useState<FilterSpec[]>([]);
  const [windowSize, setWindowSize] = useState<number>(1024);
  const [yMin, setYMin] = useState<number>(-50);
  const [yMax, setYMax] = useState<number>(20);

  const addFilter = (type: FilterType) => {
    setChain((prev) => [...prev, { ...DEFAULT_FILTER_SPECS[type], id: newFilterId() }]);
  };
  const removeFilter = (id: string) => {
    setChain((prev) => prev.filter((f) => f.id !== id));
  };
  const updateFilter = (id: string, patch: Partial<FilterSpec>) => {
    setChain((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const hasRaw = useMemo(
    () => log.gyroRaw.some((arr) => arr.some((v) => v !== 0)),
    [log],
  );

  // Bode response of the active chain — independent of the log's signal.
  const bode = useMemo(() => {
    const N = 256;
    const freqs = new Float32Array(N);
    const fStep = nyquist / (N - 1 || 1);
    for (let i = 0; i < N; i++) freqs[i] = i * fStep;
    return computeFilterChainResponse(chain, log.setup.sampleRateHz, freqs);
  }, [chain, log.setup.sampleRateHz, nyquist]);

  // Group delay near DC = "what this chain costs you" in flight-feel terms.
  const dcDelayMs = bode.groupDelayMs.length > 0 ? bode.groupDelayMs[0] : null;

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
        <p className="muted">
          Needs raw gyro (`gyroUnfilt`) to simulate filtering. Not present in this log.
        </p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Filter simulator</h2>
      <p className="muted">
        Apply a hypothetical filter chain to gyro prefilt and compare against the firmware's actual filtered
        output. Useful for choosing cutoff/Q before flashing config.
      </p>

      <div className="filter-chain">
        {chain.length === 0 && <span className="muted">Empty — add a filter to start.</span>}
        {chain.map((f) => (
          <FilterRow
            key={f.id}
            filter={f}
            nyquist={nyquist}
            onChange={(patch) => updateFilter(f.id, patch)}
            onRemove={() => removeFilter(f.id)}
          />
        ))}
        <div className="filter-add">
          <button type="button" onClick={() => addFilter('pt1')}>+ PT1 lowpass</button>
          <button type="button" onClick={() => addFilter('biquad')}>+ Biquad lowpass</button>
          <button type="button" onClick={() => addFilter('notch')}>+ Notch</button>
        </div>
      </div>

      <div className="controls">
        <label>
          FFT size:
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number.parseInt(e.target.value, 10))}
          >
            {PSD_WINDOW_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
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
      </div>

      {bode.hasFilters && (
        <div className="axis-plot">
          <h3 className="axis-plot__title">
            Filter response (chain)
            {dcDelayMs != null && (
              <span className="step-metrics">
                <span className="step-metrics__item">
                  <span className="step-metrics__k">delay @0Hz</span>
                  {dcDelayMs.toFixed(2)} ms
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
                  label: 'Group delay',
                  values: bode.groupDelayMs,
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

function FilterRow({
  filter,
  nyquist,
  onChange,
  onRemove,
}: {
  filter: FilterSpec;
  nyquist: number;
  onChange: (patch: Partial<FilterSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="filter-row">
      <input
        type="checkbox"
        checked={filter.enabled}
        onChange={(e) => onChange({ enabled: e.target.checked })}
        title="Enable / disable"
      />
      <span className="filter-row__type">
        {filter.type === 'pt1' ? 'PT1 LPF' : filter.type === 'biquad' ? 'Biquad LPF' : 'Notch'}
      </span>
      <label>
        {filter.type === 'notch' ? 'Center' : 'Cutoff'}:
        <input
          type="number"
          min={1}
          max={nyquist - 1}
          step="5"
          value={filter.cutoffHz}
          onChange={(e) => onChange({ cutoffHz: Number.parseFloat(e.target.value) })}
          style={{ width: '5rem' }}
        />
        <span className="filter-row__unit">Hz</span>
      </label>
      {filter.type === 'biquad' && (
        <label>
          Q:
          <input
            type="number"
            min={0.1}
            max={10}
            step="0.05"
            value={filter.q}
            onChange={(e) => onChange({ q: Number.parseFloat(e.target.value) })}
            style={{ width: '4rem' }}
          />
        </label>
      )}
      {filter.type === 'notch' && (
        <label>
          BW:
          <input
            type="number"
            min={1}
            step="5"
            value={filter.bandwidth}
            onChange={(e) => onChange({ bandwidth: Number.parseFloat(e.target.value) })}
            style={{ width: '4rem' }}
          />
          <span className="filter-row__unit">Hz</span>
        </label>
      )}
      <button type="button" className="filter-row__remove" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}

/* ----------------------- Full-spectrum (PSD) ---------------------- */

type SignalKey =
  | 'gyroFilt'
  | 'gyroRaw'
  | 'pterm'
  | 'iterm'
  | 'dterm'
  | 'dtermRaw'
  | 'fterm'
  | 'pidsum'
  | 'pidErr'
  | 'setpoint'
  | 'motor0'
  | 'motor1'
  | 'motor2'
  | 'motor3';

interface SignalDef {
  key: SignalKey;
  label: string;
  /** If true, the signal is the same across all axes (e.g. motors). */
  perLog: boolean;
  /** Color used when the signal is not the per-axis gyro. */
  color: string;
}

const SIGNAL_DEFS: SignalDef[] = [
  { key: 'gyroFilt', label: 'Gyro (filtered)', perLog: false, color: '' /* uses axis color */ },
  { key: 'gyroRaw', label: 'Gyro prefilt', perLog: false, color: '#c8ced9' },
  { key: 'setpoint', label: 'Setpoint', perLog: false, color: '#5dffd6' },
  { key: 'pterm', label: 'P term', perLog: false, color: '#4ee08a' },
  { key: 'iterm', label: 'I term', perLog: false, color: '#e0d24e' },
  { key: 'dterm', label: 'D term', perLog: false, color: '#5fa8ff' },
  { key: 'dtermRaw', label: 'D term prefilt', perLog: false, color: '#9bd1ff' },
  { key: 'fterm', label: 'F term', perLog: false, color: '#bd5dff' },
  { key: 'pidsum', label: 'PID sum', perLog: false, color: '#e6e6e6' },
  { key: 'pidErr', label: 'PID error', perLog: false, color: '#ffaa5d' },
  { key: 'motor0', label: 'Motor 1', perLog: true, color: '#ff5d8f' },
  { key: 'motor1', label: 'Motor 2', perLog: true, color: '#5dff5d' },
  { key: 'motor2', label: 'Motor 3', perLog: true, color: '#5db4ff' },
  { key: 'motor3', label: 'Motor 4', perLog: true, color: '#fff75d' },
];

function extractSignal(log: ParsedLog, key: SignalKey, axis: number): Float32Array | null {
  switch (key) {
    case 'gyroFilt':
      return log.gyroFilt[axis] ?? null;
    case 'gyroRaw':
      return log.gyroRaw[axis] ?? null;
    case 'pterm':
      return log.pTerm[axis] ?? null;
    case 'iterm':
      return log.iTerm[axis] ?? null;
    case 'dterm':
      return axis < 2 ? (log.dTerm[axis] ?? null) : null;
    case 'dtermRaw': {
      // -diff(gyroFilt) — conventional DtermRaw-style derivative.
      if (axis >= 2) return null;
      const gyro = log.gyroFilt[axis]!;
      const out = new Float32Array(gyro.length);
      for (let i = 0; i < gyro.length - 1; i++) out[i] = -(gyro[i + 1]! - gyro[i]!);
      return out;
    }
    case 'fterm':
      return log.fTerm[axis] ?? null;
    case 'pidsum': {
      const p = log.pTerm[axis]!;
      const ii = log.iTerm[axis]!;
      const d = axis < 2 ? log.dTerm[axis]! : new Float32Array(p.length);
      const f = log.fTerm[axis]!;
      const out = new Float32Array(p.length);
      for (let i = 0; i < p.length; i++) out[i] = p[i]! + ii[i]! + d[i]! + f[i]!;
      return out;
    }
    case 'pidErr': {
      const sp = log.setpoint[axis]!;
      const gy = log.gyroFilt[axis]!;
      const out = new Float32Array(sp.length);
      for (let i = 0; i < sp.length; i++) out[i] = sp[i]! - gy[i]!;
      return out;
    }
    case 'setpoint':
      return log.setpoint[axis] ?? null;
    case 'motor0':
      return log.motor[0] ?? null;
    case 'motor1':
      return log.motor[1] ?? null;
    case 'motor2':
      return log.motor[2] ?? null;
    case 'motor3':
      return log.motor[3] ?? null;
  }
}

const PSD_WINDOW_SIZES = [512, 1024, 2048, 4096] as const;

const MOTOR_COLORS = ['#ff5d8f', '#5dff5d', '#5db4ff', '#fff75d'] as const;

/**
 * Build harmonic-frequency markers for each enabled motor. Betaflight logs
 * eRPM as electrical_RPM / 100, so mechanical RPM = eRPM_logged * 100 / polePairs.
 * Prop blade pass freq (1st harmonic of noise) = mech_Hz * blades.
 */
function computeRpmMarkers(
  log: ParsedLog,
  enabled: ReadonlySet<number>,
  polePairs: number,
  blades: number,
  harmonics: number,
): { markers: PlotMarker[]; perMotor: Array<{ index: number; meanHz: number | null }> } {
  const markers: PlotMarker[] = [];
  const perMotor: Array<{ index: number; meanHz: number | null }> = [];

  for (let i = 0; i < log.eRpm.length; i++) {
    const arr = log.eRpm[i]!;
    if (arr.length === 0) {
      perMotor.push({ index: i, meanHz: null });
      continue;
    }
    let sum = 0;
    let n = 0;
    for (let k = 0; k < arr.length; k++) {
      const v = arr[k]!;
      if (Number.isFinite(v) && v > 0) {
        sum += v;
        n++;
      }
    }
    if (n === 0 || polePairs <= 0 || blades <= 0) {
      perMotor.push({ index: i, meanHz: null });
      continue;
    }
    const meanLogged = sum / n;
    const mechRpm = (meanLogged * 100) / polePairs;
    const mechHz = mechRpm / 60;
    const fundamentalNoiseHz = mechHz * blades;
    perMotor.push({ index: i, meanHz: fundamentalNoiseHz });

    if (!enabled.has(i)) continue;
    const color = MOTOR_COLORS[i % MOTOR_COLORS.length]!;
    for (let h = 1; h <= harmonics; h++) {
      const freq = fundamentalNoiseHz * h;
      markers.push({
        x: freq,
        stroke: color,
        width: h === 1 ? 1.5 : 1,
        dash: h === 1 ? [] : h === 2 ? [6, 4] : [3, 3],
      });
    }
  }

  return { markers, perMotor };
}

/* ------------------- Cross-tab "merge logs" plumbing ------------------- */

/**
 * Build a synthetic LogSlot representing N pooled logs. Reuses the first log's
 * parsed data so any code reading `slot.state.log` (setup, fileName, etc.) sees
 * a valid log; only the displayed filename is replaced with "Merged (N logs)".
 */
function makeMergedSlot(entries: LogEntry[]): LogSlot {
  const first = entries[0]?.slot;
  if (!first || first.state.kind !== 'ready') {
    return first ?? ({} as LogSlot);
  }
  return {
    id: '__merged__',
    enabled: true,
    dashIndex: 0,
    state: {
      kind: 'ready',
      log: { ...first.state.log, fileName: `Merged (${entries.length} logs)` },
    },
  };
}

/**
 * Shared checkbox UI for "Merge logs" toggles. Disabled (with a tooltip) when
 * there's only one log enabled.
 */
function MergeLogsToggle({
  checked,
  canMerge,
  onChange,
}: {
  checked: boolean;
  canMerge: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        opacity: canMerge ? 1 : 0.45,
        cursor: canMerge ? 'pointer' : 'not-allowed',
      }}
      title={
        canMerge
          ? 'Pool data across every enabled log into one combined view.'
          : 'Enable two or more logs in the sidebar to merge them.'
      }
    >
      <input
        type="checkbox"
        checked={checked && canMerge}
        disabled={!canMerge}
        onChange={(e) => onChange(e.target.checked)}
      />
      Merge logs
    </label>
  );
}

function FullSpectrumSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const [selected, setSelected] = useState<ReadonlySet<SignalKey>>(
    () => new Set<SignalKey>(['gyroFilt']),
  );
  // In multi-log mode, the same `selected` set is constrained to a single key.
  // First entry of `selected` is what we render.
  const singleSelected: SignalKey = multi
    ? ([...selected][0] ?? 'gyroFilt')
    : 'gyroFilt'; // unused in single mode
  const pickSingle = (key: SignalKey) => setSelected(new Set([key]));
  const [windowSize, setWindowSize] = useState<number>(1024);
  const [yMin, setYMin] = useState<number>(-50);
  const [yMax, setYMax] = useState<number>(20);

  // RPM markers state.
  const hasRpm = useMemo(
    () => log.eRpm.length > 0 && log.eRpm.some((a) => a.some((v) => v > 0)),
    [log],
  );
  const [polePairs, setPolePairs] = useState<number>(7);
  const [blades, setBlades] = useState<number>(2);
  const [harmonics, setHarmonics] = useState<number>(3);
  const [enabledMotors, setEnabledMotors] = useState<ReadonlySet<number>>(
    () => new Set(log.eRpm.map((_, i) => i)),
  );

  const { markers: rpmMarkers, perMotor } = useMemo(
    () => computeRpmMarkers(log, enabledMotors, polePairs, blades, harmonics),
    [log, enabledMotors, polePairs, blades, harmonics],
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
      multi
        ? SIGNAL_DEFS.filter((d) => d.key === singleSelected)
        : SIGNAL_DEFS.filter((d) => selected.has(d.key)),
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
        Welch's-method power spectral density. Overlay motor traces over gyro to identify which peaks
        come from motor harmonics vs. other noise sources.
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
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number.parseInt(e.target.value, 10))}
          >
            {PSD_WINDOW_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
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
                  <span className="signal-chip__swatch" style={{ background: color }} />
                  M{index + 1}
                  {meanHz != null && (
                    <span className="rpm-motor__hz">{meanHz.toFixed(0)} Hz</span>
                  )}
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

function ThrottleSpectrogramSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const others = entries.slice(1);
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const [maxFreq, setMaxFreq] = useState<number>(Math.min(500, nyquist));

  const specs = useMemo(() => {
    const rate = log.setup.sampleRateHz;
    // Convert rcCommand[3] (1000-2000 PWM in Betaflight, similar in INAV)
    // into 0-100% throttle. Clamp defensively.
    const raw = log.rcCommand[3];
    const throttlePct = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const p = (raw[i]! - 1000) / 10;
      throttlePct[i] = p < 0 ? 0 : p > 100 ? 100 : p;
    }
    return AXIS_NAMES.map((name, i) => ({
      name,
      data: computeThrottleSpectrogram(log.gyroFilt[i]!, throttlePct, rate),
    }));
  }, [log]);

  return (
    <section className="plot-section">
      <h2>
        Throttle spectrogram
        {others.length > 0 && ` — showing ${shortName(entries[0]!.slot)} only`}
      </h2>
      <p className="muted">
        Gyro frequency content vs. throttle level — vertical streaks reveal RPM-correlated motor noise.
        {others.length > 0 && " Heatmaps can't overlay — showing first enabled log only."}
      </p>
      <div className="controls">
        <label>
          Max freq:
          <select
            value={maxFreq}
            onChange={(e) => setMaxFreq(Number.parseInt(e.target.value, 10))}
          >
            {[250, 500, 750, 1000, nyquist]
              .filter((v, i, a) => v <= nyquist && a.indexOf(v) === i)
              .map((v) => (
                <option key={v} value={v}>{v} Hz</option>
              ))}
          </select>
        </label>
      </div>
      {specs.map((s, i) => (
        <div key={s.name} className="axis-plot">
          <h3 className="axis-plot__title">
            <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
            {s.name}
          </h3>
          <ThrottleSpecPlot data={s.data} maxFreqHz={maxFreq} />
        </div>
      ))}
    </section>
  );
}

/* ------------------------- Diff summary tab ----------------------- */

/** Headers worth showing in tune diff (compact subset of all raw headers). */
const TUNE_DIFF_KEYS: readonly string[] = [
  'rollPID', 'pitchPID', 'yawPID',
  'd_min', 'd_max_roll', 'd_max_pitch', 'd_max_yaw',
  'rollFF', 'pitchFF', 'yawFF', 'feedforward_roll', 'feedforward_pitch', 'feedforward_yaw',
  'rc_rates', 'rc_expo', 'rates',
  'gyro_lowpass_hz', 'gyro_lowpass_type',
  'gyro_lowpass2_hz', 'gyro_lowpass2_type',
  'gyro_notch1_hz', 'gyro_notch1_cutoff',
  'gyro_notch2_hz', 'gyro_notch2_cutoff',
  'dyn_lpf_gyro_min_hz', 'dyn_lpf_gyro_max_hz',
  'dterm_lpf_hz', 'dterm_lpf_type',
  'dterm_lpf2_hz', 'dterm_lpf2_type',
  'dterm_notch_hz', 'dterm_notch_cutoff',
  'dyn_lpf_dterm_min_hz', 'dyn_lpf_dterm_max_hz',
  'rpm_filter_harmonics', 'rpm_filter_q', 'rpm_filter_min_hz',
  'dyn_notch_count', 'dyn_notch_min_hz', 'dyn_notch_max_hz', 'dyn_notch_q',
  'looptime', 'pid_process_denom', 'motor_pwm_protocol',
];

const NOISE_BANDS: ReadonlyArray<{ label: string; lo: number; hi: number }> = [
  { label: '0–100 Hz', lo: 0, hi: 100 },
  { label: '100–300 Hz', lo: 100, hi: 300 },
  { label: '300–500 Hz', lo: 300, hi: 500 },
  { label: '500+ Hz', lo: 500, hi: Infinity },
];

/** Mean of `psdDb` between [fLo, fHi]. Returns NaN if no bins fall in range. */
function meanInBand(
  frequencies: Float32Array,
  psdDb: Float32Array,
  fLo: number,
  fHi: number,
): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i]!;
    if (f < fLo || f >= fHi) continue;
    sum += psdDb[i]!;
    n++;
  }
  return n > 0 ? sum / n : Number.NaN;
}

/** Read Betaflight `Log start datetime` from raw headers. Returns ms epoch or null. */
function parseLogStartMs(log: ParsedLog): number | null {
  const h = log.setup.rawHeaders;
  for (const key of ['Log start datetime', 'log_start_datetime']) {
    const v = h[key];
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function formatLogStartLabel(log: ParsedLog): string | null {
  const ms = parseLogStartMs(log);
  if (ms == null) return null;
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function DiffSummarySection({ entries }: { entries: LogEntry[] }) {
  // Order by Log start datetime if every log has one; otherwise use sidebar order.
  const ordered = useMemo(() => {
    const stamps = entries.map((e) => parseLogStartMs(e.log));
    if (stamps.every((t) => t != null)) {
      const indexed = entries.map((e, i) => ({ e, t: stamps[i]! }));
      indexed.sort((a, b) => a.t - b.t);
      return indexed.map((x) => x.e);
    }
    return entries;
  }, [entries]);

  const steps = useMemo(
    () => ordered.map(({ slot, log }) => ({ slot, axes: computeAxisSteps(log) })),
    [ordered],
  );

  const psds = useMemo(
    () =>
      ordered.map(({ slot, log }) => ({
        slot,
        axes: AXIS_NAMES.map((_n, i) =>
          computePsd(log.gyroFilt[i]!, log.setup.sampleRateHz, { windowSize: 1024 }),
        ),
      })),
    [ordered],
  );

  if (ordered.length < 2) {
    return (
      <section className="plot-section">
        <h2>Diff summary</h2>
        <p className="muted">
          Load and enable a second log in the sidebar to compare. Drag log cards in the sidebar to
          set chronological order (used when logs don&apos;t carry a start-time header).
        </p>
      </section>
    );
  }

  const allTimed = ordered.every((e) => parseLogStartMs(e.log) != null);

  return (
    <section className="plot-section">
      <h2>Diff summary</h2>
      <p className="muted">
        {allTimed
          ? 'Logs sorted chronologically by start datetime.'
          : 'Logs in sidebar order — drag cards to reorder.'}
        {' '}Values compared to the prior log:
        {' '}<span className="diff-tok--up">green</span> = increased,
        {' '}<span className="diff-tok--down">red</span> = decreased.
      </p>

      <div className="diff-section">
        <h3>Tune settings</h3>
        {ordered.map((entry, i) => (
          <TuneDiffBlock
            key={entry.slot.id}
            entry={entry}
            prev={i > 0 ? ordered[i - 1]! : null}
          />
        ))}
      </div>

      <div className="diff-section">
        <h3>Step response</h3>
        {steps.map((s, i) => (
          <StepDiffBlock
            key={s.slot.id}
            current={s}
            prev={i > 0 ? steps[i - 1]! : null}
          />
        ))}
      </div>

      <div className="diff-section">
        <h3>Filtered gyro noise floor</h3>
        {psds.map((p, i) => (
          <NoiseDiffBlock
            key={p.slot.id}
            current={p}
            prev={i > 0 ? psds[i - 1]! : null}
          />
        ))}
      </div>
    </section>
  );
}

function DiffBlockHeader({
  slot,
  log,
  prev,
}: {
  slot: LogSlot;
  log: ParsedLog | null;
  prev: LogSlot | null;
}) {
  const stamp = log ? formatLogStartLabel(log) : null;
  return (
    <h4 className="diff-log__head">
      <span className="diff-log__chip" style={{ background: colorFor(slot) }} />
      <span className="diff-log__name">{shortName(slot)}</span>
      {stamp && <span className="diff-log__stamp">{stamp}</span>}
      <span className="diff-log__vs">
        {prev ? `vs ${shortName(prev)}` : 'baseline'}
      </span>
    </h4>
  );
}

function TuneDiffBlock({ entry, prev }: { entry: LogEntry; prev: LogEntry | null }) {
  const h = entry.log.setup.rawHeaders;
  const ph = prev?.log.setup.rawHeaders;
  const isBaseline = prev == null;

  const rows = TUNE_DIFF_KEYS
    .map((key) => ({ key, value: h[key], prev: ph?.[key] }))
    .filter((r) => {
      if (isBaseline) return r.value !== undefined && r.value !== '';
      return (r.value ?? '') !== (r.prev ?? '');
    });

  return (
    <div className="diff-log">
      <DiffBlockHeader slot={entry.slot} log={entry.log} prev={prev?.slot ?? null} />
      {rows.length === 0 ? (
        <p className="muted diff-log__none">
          {isBaseline ? 'No tune settings logged.' : 'No setting changes.'}
        </p>
      ) : (
        <table className="diff-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th>{r.key}</th>
                <td>
                  <ComparedTokens value={r.value} prev={r.prev} dim={isBaseline} />
                </td>
                {!isBaseline && (
                  <td className="diff-table__was muted">{r.prev ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StepDiffBlock({
  current,
  prev,
}: {
  current: { slot: LogSlot; axes: ReturnType<typeof computeAxisSteps> };
  prev: { slot: LogSlot; axes: ReturnType<typeof computeAxisSteps> } | null;
}) {
  return (
    <div className="diff-log">
      <DiffBlockHeader slot={current.slot} log={null} prev={prev?.slot ?? null} />
      <table className="diff-table">
        <tbody>
          {AXIS_NAMES.map((name, i) => {
            const c = current.axes[i]!.metrics;
            const p = prev?.axes[i]!.metrics ?? null;
            return (
              <tr key={name}>
                <th>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
                <td className="diff-table__metrics">
                  <ComparedNumber value={c.riseTimeMs} prev={p?.riseTimeMs ?? null} unit="ms" label="rise" dim={!prev} />
                  <ComparedNumber value={c.overshootPct} prev={p?.overshootPct ?? null} unit="%" label="over" dim={!prev} />
                  <ComparedNumber value={c.settlingTimeMs} prev={p?.settlingTimeMs ?? null} unit="ms" label="settle" dim={!prev} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NoiseDiffBlock({
  current,
  prev,
}: {
  current: { slot: LogSlot; axes: Array<{ frequencies: Float32Array; psdDb: Float32Array }> };
  prev: { slot: LogSlot; axes: Array<{ frequencies: Float32Array; psdDb: Float32Array }> } | null;
}) {
  return (
    <div className="diff-log">
      <DiffBlockHeader slot={current.slot} log={null} prev={prev?.slot ?? null} />
      <table className="diff-table">
        <thead>
          <tr>
            <th></th>
            {NOISE_BANDS.map((b) => (
              <th key={b.label}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AXIS_NAMES.map((name, axis) => {
            const c = current.axes[axis]!;
            const p = prev?.axes[axis] ?? null;
            return (
              <tr key={name}>
                <th>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[axis] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
                {NOISE_BANDS.map((b) => {
                  const cv = meanInBand(c.frequencies, c.psdDb, b.lo, b.hi);
                  const pv = p ? meanInBand(p.frequencies, p.psdDb, b.lo, b.hi) : null;
                  return (
                    <td key={b.label}>
                      <ComparedNumber
                        value={Number.isFinite(cv) ? cv : null}
                        prev={pv != null && Number.isFinite(pv) ? pv : null}
                        unit="dB"
                        dim={!prev}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a comma-separated value, coloring each numeric token vs the prior value's same position. */
function ComparedTokens({
  value,
  prev,
  dim,
}: {
  value: string | undefined;
  prev: string | undefined;
  dim: boolean;
}) {
  if (value === undefined || value === '') return <span className="muted">—</span>;
  if (dim) return <span>{value}</span>;
  const vTokens = value.split(',');
  const pTokens = prev?.split(',') ?? [];
  return (
    <span className="diff-tokens">
      {vTokens.map((tok, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="diff-tok-sep">,</span>}
          <span className={tokenClass(tok, pTokens[i])}>{tok}</span>
        </Fragment>
      ))}
    </span>
  );
}

function tokenClass(v: string, prev: string | undefined): string {
  if (prev === undefined || v.trim() === prev.trim()) return '';
  const vn = Number(v);
  const pn = Number(prev);
  if (!Number.isFinite(vn) || !Number.isFinite(pn)) return 'diff-tok--changed';
  if (vn > pn) return 'diff-tok--up';
  if (vn < pn) return 'diff-tok--down';
  return '';
}

function ComparedNumber({
  value,
  prev,
  unit,
  label,
  dim,
  decimals = 1,
}: {
  value: number | null;
  prev: number | null;
  unit: string;
  label?: string;
  dim?: boolean;
  decimals?: number;
}) {
  if (value == null) return <span className="muted">—</span>;
  const valueStr = `${value.toFixed(decimals)} ${unit}`;
  const cls = !dim && prev != null
    ? value > prev ? 'diff-tok--up'
    : value < prev ? 'diff-tok--down'
    : ''
    : '';
  return (
    <span className="diff-metric">
      {label && <span className="diff-metric__label">{label}</span>}
      <span className={cls}>{valueStr}</span>
    </span>
  );
}

/* ---------------------- PID terms breakout tab --------------------- */

type PidTermKey = 'pterm' | 'iterm' | 'dterm' | 'dtermRaw' | 'fterm' | 'pidsum' | 'pidErr';

interface PidTermDef {
  key: PidTermKey;
  signalKey: SignalKey; // for extractSignal()
  label: string;
  color: string;
}

const PID_TERM_DEFS: PidTermDef[] = [
  { key: 'pterm', signalKey: 'pterm', label: 'P', color: '#4ee08a' },
  { key: 'iterm', signalKey: 'iterm', label: 'I', color: '#e0d24e' },
  { key: 'dterm', signalKey: 'dterm', label: 'D', color: '#5fa8ff' },
  { key: 'dtermRaw', signalKey: 'dtermRaw', label: 'D prefilt', color: '#9bd1ff' },
  { key: 'fterm', signalKey: 'fterm', label: 'F', color: '#bd5dff' },
  { key: 'pidsum', signalKey: 'pidsum', label: 'PID sum', color: '#e6e6e6' },
  { key: 'pidErr', signalKey: 'pidErr', label: 'PID error', color: '#ffaa5d' },
];

function PidTermsSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;

  const [selected, setSelected] = useState<ReadonlySet<PidTermKey>>(
    () => new Set<PidTermKey>(['pterm', 'iterm']),
  );
  const singleSelected: PidTermKey = multi ? ([...selected][0] ?? 'pterm') : 'pterm';

  const toggleTerm = (key: PidTermKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const pickSingleTerm = (key: PidTermKey) => setSelected(new Set([key]));

  const availability = useMemo<Record<PidTermKey, boolean>>(() => {
    const out = {} as Record<PidTermKey, boolean>;
    for (const def of PID_TERM_DEFS) {
      const sample = extractSignal(primary.log, def.signalKey, 0);
      out[def.key] = !!sample && sample.length > 0 && sample.some((v) => v !== 0);
    }
    return out;
  }, [primary.log]);

  const activeDefs = useMemo(
    () =>
      multi
        ? PID_TERM_DEFS.filter((d) => d.key === singleSelected)
        : PID_TERM_DEFS.filter((d) => selected.has(d.key)),
    [multi, singleSelected, selected],
  );

  return (
    <section className="plot-section">
      <h2>PID terms</h2>
      <p className="muted">
        {multi
          ? 'Multi-log: pick one term — each log drawn in its sidebar color.'
          : 'Per-axis controller term contributions over time. Diagnose I-term wind-up, F-term overshoots, D-term spikes.'}
      </p>

      <div className="signal-grid">
        {PID_TERM_DEFS.map((def) => {
          const present = availability[def.key];
          const checked = multi ? singleSelected === def.key : selected.has(def.key);
          return (
            <label
              key={def.key}
              className={`signal-chip${checked ? ' signal-chip--on' : ''}${present ? '' : ' signal-chip--off'}`}
            >
              <input
                type={multi ? 'radio' : 'checkbox'}
                name={multi ? 'pid-term' : undefined}
                checked={checked}
                disabled={!present}
                onChange={() => (multi ? pickSingleTerm(def.key) : toggleTerm(def.key))}
              />
              <span className="signal-chip__swatch" style={{ background: def.color }} />
              {def.label}
              {!present && <span className="signal-chip__note">(not logged)</span>}
            </label>
          );
        })}
      </div>

      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];
        for (const def of activeDefs) {
          for (const entry of entries) {
            const sig = extractSignal(entry.log, def.signalKey, i);
            if (!sig || sig.length === 0) continue;
            const values = align(sig, N);
            if (multi) {
              series.push({
                label: shortName(entry.slot),
                values,
                stroke: colorFor(entry.slot),
                width: 1.5,
              });
            } else {
              series.push({
                label: def.label,
                values,
                stroke: def.color,
                width: 1.2,
              });
            }
          }
        }
        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            {series.length > 0 ? (
              <TimeSeriesPlot
                time={primary.log.time}
                series={series}
                yLabel="output"
                height={220}
              />
            ) : (
              <p className="muted">No data for selected terms on this axis.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* ---------------------- Motors + throttle tab ---------------------- */

/* --------------------------- Motor balance tab -------------------------- */

/* --------------------------- I-term saturation -------------------------- */

const SAT_BAND_COLOR = 'rgba(255, 112, 112, 0.18)';

function SaturationSection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;
  const analyses = useMemo(
    () => entries.map(({ slot, log }) => ({ slot, log, analysis: analyzeSaturation(log) })),
    [entries],
  );

  return (
    <section className="plot-section">
      <h2>I-term saturation</h2>
      <p className="muted">
        Highlights time spans where I-term hit (or came close to) its configured limit per axis.
        Sustained saturation means the controller ran out of authority — usually a sign of an
        underpowered or unbalanced craft, or aggressive maneuvering beyond what the tune can handle.
      </p>
      {analyses.map(({ slot, log, analysis }) => (
        <SaturationLogCard
          key={slot.id}
          slot={slot}
          log={log}
          analysis={analysis}
          multi={multi}
        />
      ))}
    </section>
  );
}

function SaturationLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: SaturationAnalysis;
  multi: boolean;
}) {
  const limitNote = analysis.itermLimit != null
    ? `limit ${analysis.itermLimit}`
    : `limit default 400 (not in headers)`;
  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        <span className="diff-log__vs">{limitNote}</span>
      </h4>

      <div className="battery-stats">
        {analysis.axes.map((a) => {
          const cls =
            a.fraction >= 0.05 ? 'diff-tok--down'
              : a.fraction >= 0.01 ? 'diff-tok--changed'
              : 'diff-tok--up';
          return (
            <div key={a.axisIndex} className="battery-stat">
              <span className="battery-stat__label">
                {a.axisName.toUpperCase()}
              </span>
              <span className={`battery-stat__value ${cls}`}>
                {(a.fraction * 100).toFixed(1)}%
              </span>
              <span className="scorecard-detail">
                peak {a.peakAbs.toFixed(0)} · longest {a.longestRunSec.toFixed(2)}s · {a.runs.length} runs
              </span>
            </div>
          );
        })}
      </div>

      {analysis.axes.map((a) => {
        const series: PlotSeries[] = [
          {
            label: `iTerm ${a.axisName}`,
            values: log.iTerm[a.axisIndex]!,
            stroke: AXIS_COLORS[a.axisIndex]!,
            width: 1,
          },
        ];
        const bands: PlotBand[] = a.runs.map((r) => ({
          x0: r.t0,
          x1: r.t1,
          fill: SAT_BAND_COLOR,
        }));
        return (
          <div key={a.axisIndex} className="axis-plot" style={{ marginTop: '0.5rem' }}>
            <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[a.axisIndex] }} />
              {a.axisName} — threshold {a.threshold.toFixed(0)}
            </h5>
            <TimeSeriesPlot
              time={log.time}
              series={series}
              yLabel="iTerm"
              bands={bands}
              height={140}
              showLegend={false}
            />
          </div>
        );
      })}
    </div>
  );
}

function BalanceSection({ entries }: { entries: LogEntry[] }) {
  const motorCount = entries[0]!.log.motor.length;
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;

  const analyses = useMemo<Array<{ slot: LogSlot; analysis: BalanceAnalysis }>>(() => {
    const perLog = entries.map(({ slot, log }) => ({ slot, analysis: analyzeMotorBalance(log) }));
    if (!effectiveMerge) return perLog;
    return [
      {
        slot: makeMergedSlot(entries),
        analysis: combineMotorBalances(perLog.map((p) => p.analysis)),
      },
    ];
  }, [entries, effectiveMerge]);

  if (motorCount === 0) {
    return (
      <section className="plot-section">
        <h2>Motor balance</h2>
        <p className="muted">No motor channels logged.</p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Motor balance</h2>
      <p className="muted">
        {effectiveMerge && `Pooling ${entries.length} logs into one combined view. `}
        Per-motor command stats and noise PSD. A motor whose mean PWM is meaningfully above the
        others is fighting harder — often a bent prop, weak motor, or lopsided mounting. Spikes on
        one motor&apos;s PSD that aren&apos;t on the others point to that motor specifically.
      </p>

      <div className="controls" style={{ marginBottom: '0.5rem' }}>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      {analyses.map(({ slot, analysis }) => (
        <div key={slot.id} className="diff-log">
          <h4 className="diff-log__head">
            {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
            <span className="diff-log__name">{shortName(slot)}</span>
            <BalanceAxisStrip
              axes={analysis.axes}
              dominantAxis={analysis.dominantAxis}
              singleOutlier={analysis.singleMotorOutlier}
            />
          </h4>
          <BalanceStatsTable analysis={analysis} />
          <BalancePsdPlot analysis={analysis} />
        </div>
      ))}

      <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
        Axes are projections of the per-motor mean onto pitch / roll / yaw using the default
        Quad-X mixer (M1=RR/CW, M2=FR/CCW, M3=RL/CCW, M4=FL/CW). Sign tells you which diagonal
        pair is higher — interpret against your own motor mapping.
      </p>
    </section>
  );
}

function BalanceAxisStrip({
  axes,
  dominantAxis,
  singleOutlier,
}: {
  axes: AxisImbalance[];
  dominantAxis: AxisImbalance['axis'] | null;
  singleOutlier: { motorIndex: number; deltaPct: number } | null;
}) {
  if (axes.length === 0 && singleOutlier == null) {
    return <span className="balance-tag balance-tag--ok">balanced</span>;
  }
  return (
    <span className="balance-axis-strip">
      {axes.map((a) => {
        const isDominant = a.axis === dominantAxis;
        const sign = a.deltaPct >= 0 ? '+' : '';
        return (
          <span
            key={a.axis}
            className={`balance-axis${isDominant ? ' balance-axis--dom' : ''}`}
          >
            <span className="balance-axis__label">{a.axis}</span>
            <span className="balance-axis__value">
              {sign}{a.deltaPct.toFixed(1)}%
            </span>
          </span>
        );
      })}
      {singleOutlier && (
        <span className="balance-tag balance-tag--warn">
          M{singleOutlier.motorIndex + 1} outlier · {singleOutlier.deltaPct >= 0 ? '+' : ''}
          {singleOutlier.deltaPct.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

function BalanceStatsTable({ analysis }: { analysis: BalanceAnalysis }) {
  const { motors, singleMotorOutlier } = analysis;
  const outlierMotor = singleMotorOutlier?.motorIndex ?? null;
  const maxLoad = Math.max(...motors.map((m) => m.relativeLoad), 1);
  return (
    <table className="diff-table balance-table">
      <thead>
        <tr>
          <th>Motor</th>
          <th>Mean PWM</th>
          <th>Load</th>
          <th>PWM σ</th>
          <th>Mean eRPM</th>
          <th>eRPM CV</th>
        </tr>
      </thead>
      <tbody>
        {motors.map((m) => {
          const color = MOTOR_COLORS[m.motorIndex % MOTOR_COLORS.length]!;
          const flagged = m.motorIndex === outlierMotor;
          return (
            <tr key={m.motorIndex} className={flagged ? 'balance-row--outlier' : undefined}>
              <th>
                <span className="balance-chip" style={{ background: color }}>
                  M{m.motorIndex + 1}
                </span>
              </th>
              <td>{m.pwmMean.toFixed(0)}</td>
              <td>
                <div className="balance-bar">
                  <div
                    className="balance-bar__fill"
                    style={{
                      width: `${(m.relativeLoad / maxLoad) * 100}%`,
                      background: flagged ? '#ff7070' : color,
                    }}
                  />
                  <span className="balance-bar__label">{m.relativeLoad.toFixed(1)}%</span>
                </div>
              </td>
              <td>{m.pwmStd.toFixed(1)}</td>
              <td>{m.meanERpm != null ? m.meanERpm.toFixed(0) : <span className="muted">—</span>}</td>
              <td>{m.erpmCv != null ? `${(m.erpmCv * 100).toFixed(1)}%` : <span className="muted">—</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BalancePsdPlot({ analysis }: { analysis: BalanceAnalysis }) {
  const psds = analysis.motorPsds;
  if (psds.length === 0 || psds[0]!.frequencies.length === 0) return null;
  const freq = psds[0]!.frequencies;
  const nyquist = freq[freq.length - 1]!;

  const highlightMotor = analysis.singleMotorOutlier?.motorIndex ?? null;
  const series: PlotSeries[] = psds.map((p, i) => ({
    label: `M${i + 1}`,
    values: p.psdDb,
    stroke: MOTOR_COLORS[i % MOTOR_COLORS.length]!,
    width: i === highlightMotor ? 2 : 1,
  }));

  return (
    <div className="axis-plot" style={{ marginTop: '0.75rem' }}>
      <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
        Motor command PSD — spikes on one motor only = that motor is the source
      </h5>
      <TimeSeriesPlot
        time={freq}
        series={series}
        yLabel="dB"
        xLabel="Hz"
        xMin={0}
        xMax={Math.min(nyquist, 500)}
        height={200}
      />
    </div>
  );
}

/* ------------------------------ Battery tab ----------------------------- */

const VOLT_COLOR = '#5fa8ff';
const CURRENT_COLOR = '#ffaa5d';

function BatterySection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;

  const analyses = useMemo(
    () => entries.map(({ slot, log }) => ({ slot, log, analysis: analyzeBattery(log) })),
    [entries],
  );

  const anyHasVbat = analyses.some((a) => a.analysis.hasVoltage);
  const anyHasCurrent = analyses.some((a) => a.analysis.hasCurrent);

  if (!anyHasVbat && !anyHasCurrent) {
    return (
      <section className="plot-section">
        <h2>Battery</h2>
        <p className="muted">
          No vbat or amperage telemetry in any loaded log. Check that the BF Power tab has voltage
          and current meters enabled, and that <code>vbatLatest</code> / <code>amperageLatest</code>
          are in the blackbox field whitelist.
        </p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Battery</h2>
      <p className="muted">
        Pack health under load. Sag is the mean voltage drop during high-current periods (top 25%
        of current readings) versus the resting peak. Per-cell numbers assume cell count = round(max
        voltage / 4.15V).
      </p>

      {analyses.map(({ slot, log, analysis }) => (
        <BatteryLogCard key={slot.id} slot={slot} log={log} analysis={analysis} multi={multi} />
      ))}
    </section>
  );
}

function BatteryLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: BatteryAnalysis;
  multi: boolean;
}) {
  const slow = log.slow;
  const vbatSeries: PlotSeries[] = analysis.hasVoltage
    ? [{ label: 'vbat', values: slow.vbat, stroke: VOLT_COLOR, width: 1.5 }]
    : [];
  const currentSeries: PlotSeries[] = analysis.hasCurrent
    ? [{ label: 'current', values: slow.amperage, stroke: CURRENT_COLOR, width: 1.5 }]
    : [];

  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        {analysis.cellCount != null && (
          <span className="diff-log__vs">{analysis.cellCount}S pack</span>
        )}
      </h4>

      <BatteryStats analysis={analysis} />

      {vbatSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>Voltage (V)</h5>
          <TimeSeriesPlot
            time={slow.time}
            series={vbatSeries}
            yLabel="V"
            height={180}
            showLegend={false}
          />
        </div>
      )}

      {currentSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>Current (A)</h5>
          <TimeSeriesPlot
            time={slow.time}
            series={currentSeries}
            yLabel="A"
            height={180}
            showLegend={false}
          />
        </div>
      )}
    </div>
  );
}

function BatteryStats({ analysis }: { analysis: BatteryAnalysis }) {
  const rows: Array<{ label: string; value: string; cls?: string }> = [];
  if (analysis.hasVoltage) {
    rows.push({ label: 'V start', value: fmtV(analysis.voltageStart) });
    rows.push({ label: 'V end', value: fmtV(analysis.voltageEnd) });
    rows.push({ label: 'V min', value: fmtV(analysis.voltageMin) });
    if (analysis.perCellMin != null) {
      const cls =
        analysis.perCellMin < 3.3 ? 'diff-tok--down'
          : analysis.perCellMin < 3.5 ? 'diff-tok--changed'
          : 'diff-tok--up';
      rows.push({ label: 'V/cell min', value: `${analysis.perCellMin.toFixed(2)} V`, cls });
    }
    if (analysis.sagUnderLoadV != null) {
      rows.push({ label: 'Mean sag', value: `${analysis.sagUnderLoadV.toFixed(2)} V` });
    }
  }
  if (analysis.hasCurrent) {
    rows.push({ label: 'Mean A', value: fmtA(analysis.meanCurrentA) });
    rows.push({ label: 'Peak A', value: fmtA(analysis.peakCurrentA) });
    if (analysis.mAhUsed != null) {
      rows.push({ label: 'Used', value: `${analysis.mAhUsed.toFixed(0)} mAh` });
    }
  }
  return (
    <div className="battery-stats">
      {rows.map((r) => (
        <div key={r.label} className="battery-stat">
          <span className="battery-stat__label">{r.label}</span>
          <span className={`battery-stat__value${r.cls ? ` ${r.cls}` : ''}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function fmtV(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(2)} V`;
}

function fmtA(a: number | null): string {
  return a == null ? '—' : `${a.toFixed(1)} A`;
}

/* ------------------------------- GPS tab -------------------------------- */

function GpsSection({
  sources,
  windowRange,
}: {
  sources: Array<{ slot: LogSlot; log: ParsedLog }>;
  windowRange: TimeRangeSec;
}) {
  const multi = sources.length > 1;

  const analyses = useMemo(
    () =>
      sources.map(({ slot, log }) => {
        const view = sliceLog(log, gpsViewerEffectiveRange(log, windowRange));
        return { slot, log: view, analysis: analyzeGps(view.gps) };
      }),
    [sources, windowRange],
  );

  const anyFix = analyses.some((a) => a.analysis.hasFix);
  if (!anyFix) {
    return (
      <section className="plot-section">
        <h2>GPS</h2>
        <p className="muted">
          No GPS frames in any loaded log. The flight controller&apos;s GPS feature must be enabled
          and the receiver must have a fix at log time.
        </p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>GPS</h2>
      <p className="muted">
        Follow the route on the map — green and red dots are the ends of this window. Playback walks
        the path over time; the arrow shows which way you were moving along the line (from the GPS
        track shape). Altitude colors the track when it&apos;s in the log. The GPS tab uses the time
        bar above intersected with the flight: it hides the usual pre-lock plateau (e.g. altitude
        stuck at zero) so plots start where the receiver becomes useful, without changing other
        tabs. The map applies a fixed light smoothing on lat/lon for display only (altitude/speed
        plots stay on raw latch samples).
      </p>
      {analyses.map(({ slot, log, analysis }) =>
        analysis.hasFix ? (
          <GpsLogCard
            key={slot.id}
            slot={slot}
            log={log}
            analysis={analysis}
            multi={multi}
          />
        ) : (
          <div key={slot.id} className="diff-log">
            <h4 className="diff-log__head">
              {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
              <span className="diff-log__name">{shortName(slot)}</span>
              <span className="diff-log__vs">no fix</span>
            </h4>
            <p className="muted">No GPS frames in this log.</p>
          </div>
        ),
      )}
    </section>
  );
}

function GpsLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: GpsAnalysis;
  multi: boolean;
}) {
  const gpsSamples = useMemo(
    () => buildValidGpsSamples(log.gps.time, log.gps.lat, log.gps.lon),
    [log.gps.time, log.gps.lat, log.gps.lon],
  );
  const gpsTMin = gpsSamples[0]?.t ?? 0;
  const gpsTMax = gpsSamples[gpsSamples.length - 1]?.t ?? 0;

  const [playbackT, setPlaybackT] = useState(gpsTMin);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useLayoutEffect(() => {
    setPlaybackT(gpsTMin);
    setPlaying(false);
  }, [gpsTMin, gpsTMax, slot.id]);

  const onPlaybackTChange = useCallback((t: number) => setPlaybackT(t), []);
  const onPlayingChange = useCallback((playingNext: boolean) => setPlaying(playingNext), []);
  const onPlaybackSpeedChange = useCallback((speed: number) => setPlaybackSpeed(speed), []);

  const gpsPlaybackMarkers: PlotMarker[] = useMemo(() => {
    if (!(gpsTMax > gpsTMin)) return [];
    return [
      {
        x: playbackT,
        stroke: '#e8eef8',
        width: 1.75,
        dash: [4, 4],
      },
    ];
  }, [playbackT, gpsTMin, gpsTMax]);

  const altitudeSegmentStrokeColors = useMemo(() => {
    if (analysis.maxAltitudeM == null || log.gps.altitude.length < 2) return undefined;
    return gpsAltitudeViridisSegments(
      log.gps.lat,
      log.gps.lon,
      log.gps.altitude,
      '#5fa8ff',
    );
  }, [analysis.maxAltitudeM, log.gps.lat, log.gps.lon, log.gps.altitude]);

  const altSeries: PlotSeries[] = analysis.maxAltitudeM != null
    ? [{ label: 'altitude', values: log.gps.altitude, stroke: '#5fa8ff', width: 1.5 }]
    : [];
  const speedSeries: PlotSeries[] = analysis.maxSpeedMs != null
    ? [{ label: 'speed', values: log.gps.speed, stroke: '#ffaa5d', width: 1.5 }]
    : [];

  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        <span className="diff-log__vs">
          {(analysis.totalDistanceM / 1000).toFixed(2)} km · max alt{' '}
          {analysis.maxAltitudeM != null ? `${analysis.maxAltitudeM.toFixed(0)} m` : '—'} · max{' '}
          {analysis.maxSpeedMs != null ? `${analysis.maxSpeedMs.toFixed(1)} m/s` : '—'}
        </span>
      </h4>

      <div className="battery-stats">
        <GpsStat label="Distance" value={`${(analysis.totalDistanceM / 1000).toFixed(2)} km`} />
        <GpsStat
          label="Max alt"
          value={analysis.maxAltitudeM != null ? `${analysis.maxAltitudeM.toFixed(0)} m` : '—'}
        />
        <GpsStat
          label="Max speed"
          value={analysis.maxSpeedMs != null
            ? `${analysis.maxSpeedMs.toFixed(1)} m/s · ${(analysis.maxSpeedMs * 3.6).toFixed(0)} km/h`
            : '—'}
        />
        <GpsStat
          label="Avg speed"
          value={analysis.meanSpeedMs != null
            ? `${analysis.meanSpeedMs.toFixed(1)} m/s`
            : '—'}
        />
        <GpsStat
          label="Sats min"
          value={analysis.minSats != null ? `${analysis.minSats}` : '—'}
        />
      </div>

      <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
        <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>Ground track</h5>
        <GpsMapTrack
          gpsTime={log.gps.time}
          lat={log.gps.lat}
          lon={log.gps.lon}
          altitude={log.gps.altitude}
          colorByLabel="altitude (m)"
          height={360}
          playbackT={playbackT}
          onPlaybackTChange={onPlaybackTChange}
          playing={playing}
          onPlayingChange={onPlayingChange}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={onPlaybackSpeedChange}
        />
      </div>

      {altSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>Altitude (m)</h5>
          <TimeSeriesPlot
            time={log.gps.time}
            series={altSeries}
            yLabel="m"
            height={180}
            showLegend={false}
            markers={gpsPlaybackMarkers}
            segmentStrokeColors={altitudeSegmentStrokeColors}
          />
        </div>
      )}

      {speedSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>Speed (m/s)</h5>
          <TimeSeriesPlot
            time={log.gps.time}
            series={speedSeries}
            yLabel="m/s"
            height={180}
            showLegend={false}
            markers={gpsPlaybackMarkers}
          />
        </div>
      )}
    </div>
  );
}

function GpsStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="battery-stat">
      <span className="battery-stat__label">{label}</span>
      <span className="battery-stat__value">{value}</span>
    </div>
  );
}

function MotorsSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;

  const motorCount = primary.log.motor.length;
  const hasERpm = useMemo(
    () => entries.some(({ log }) => log.eRpm.length > 0 && log.eRpm.some((arr) => arr.some((v) => v > 0))),
    [entries],
  );

  // In multi-log mode, pick a single motor to compare across logs.
  const [selectedMotor, setSelectedMotor] = useState<number>(0);

  if (motorCount === 0) {
    return (
      <section className="plot-section">
        <h2>Motors & throttle</h2>
        <p className="muted">No motor channels logged.</p>
      </section>
    );
  }

  const N = primary.log.time.length;

  // Throttle plot: rcCommand[3], shared across modes.
  const throttleSeries: PlotSeries[] = multi
    ? entries.map((e) => ({
        label: shortName(e.slot),
        values: align(e.log.rcCommand[3]!, N),
        stroke: colorFor(e.slot),
        width: 1,
      }))
    : [
        {
          label: 'Throttle',
          values: primary.log.rcCommand[3]!,
          stroke: '#bd5dff',
          width: 1,
        },
      ];

  // Motor plots.
  const motorSeries: PlotSeries[] = [];
  if (multi) {
    for (const e of entries) {
      const sig = e.log.motor[selectedMotor];
      if (!sig) continue;
      motorSeries.push({
        label: shortName(e.slot),
        values: align(sig, N),
        stroke: colorFor(e.slot),
        width: 1,
      });
    }
  } else {
    primary.log.motor.forEach((sig, idx) => {
      motorSeries.push({
        label: `Motor ${idx + 1}`,
        values: sig,
        stroke: MOTOR_COLORS[idx % MOTOR_COLORS.length]!,
        width: 1,
      });
    });
  }

  // eRPM plots (mirror motor logic).
  const erpmSeries: PlotSeries[] = [];
  if (hasERpm) {
    if (multi) {
      for (const e of entries) {
        const sig = e.log.eRpm[selectedMotor];
        if (!sig || sig.length === 0) continue;
        erpmSeries.push({
          label: shortName(e.slot),
          values: align(sig, N),
          stroke: colorFor(e.slot),
          width: 1,
        });
      }
    } else {
      primary.log.eRpm.forEach((sig, idx) => {
        erpmSeries.push({
          label: `Motor ${idx + 1}`,
          values: sig,
          stroke: MOTOR_COLORS[idx % MOTOR_COLORS.length]!,
          width: 1,
        });
      });
    }
  }

  return (
    <section className="plot-section">
      <h2>Motors & throttle</h2>
      <p className="muted">
        {multi
          ? `Multi-log: pick a motor below — each log drawn in its sidebar color. Throttle shown across all logs.`
          : 'Throttle command, per-motor PWM output, and (if logged) eRPM telemetry over time.'}
      </p>

      {multi && (
        <div className="controls">
          <span className="muted">Motor:</span>
          {Array.from({ length: motorCount }, (_, idx) => (
            <label key={idx} className={`signal-chip${selectedMotor === idx ? ' signal-chip--on' : ''}`}>
              <input
                type="radio"
                name="motor-pick"
                checked={selectedMotor === idx}
                onChange={() => setSelectedMotor(idx)}
              />
              <span
                className="signal-chip__swatch"
                style={{ background: MOTOR_COLORS[idx % MOTOR_COLORS.length] }}
              />
              M{idx + 1}
            </label>
          ))}
        </div>
      )}

      <div className="axis-plot">
        <h3 className="axis-plot__title">Throttle command</h3>
        <TimeSeriesPlot
          time={primary.log.time}
          series={throttleSeries}
          yLabel="PWM"
          height={180}
        />
      </div>

      <div className="axis-plot">
        <h3 className="axis-plot__title">
          Motor output{multi ? ` — M${selectedMotor + 1}` : 's'}
        </h3>
        <TimeSeriesPlot
          time={primary.log.time}
          series={motorSeries}
          yLabel="PWM"
          height={220}
        />
      </div>

      {hasERpm && (
        <div className="axis-plot">
          <h3 className="axis-plot__title">
            eRPM{multi ? ` — M${selectedMotor + 1}` : ''}
          </h3>
          <TimeSeriesPlot
            time={primary.log.time}
            series={erpmSeries}
            yLabel="eRPM/100"
            height={200}
          />
        </div>
      )}
    </section>
  );
}

/** Resize `values` to match `length` by trimming or repeating the last value. */
function align(values: Float32Array, length: number): Float32Array {
  if (values.length === length) return values;
  const out = new Float32Array(length);
  const n = Math.min(values.length, length);
  for (let i = 0; i < n; i++) out[i] = values[i]!;
  const fill = n > 0 ? values[n - 1]! : 0;
  for (let i = n; i < length; i++) out[i] = fill;
  return out;
}

/** Linear-interpolation resample of `(srcX, srcY)` onto `targetX`. */
function resampleY(srcX: Float32Array, srcY: Float32Array, targetX: Float32Array): Float32Array {
  const out = new Float32Array(targetX.length);
  if (srcX.length < 2) {
    out.fill(srcY[0] ?? 0);
    return out;
  }
  let si = 0;
  for (let ti = 0; ti < targetX.length; ti++) {
    const t = targetX[ti]!;
    while (si < srcX.length - 1 && srcX[si + 1]! < t) si++;
    if (si >= srcX.length - 1) {
      out[ti] = srcY[srcX.length - 1]!;
    } else {
      const x0 = srcX[si]!;
      const x1 = srcX[si + 1]!;
      const denom = x1 - x0;
      const frac = denom === 0 ? 0 : (t - x0) / denom;
      out[ti] = srcY[si]! + frac * (srcY[si + 1]! - srcY[si]!);
    }
  }
  return out;
}

/* ---------------------------- Scorecard tab ----------------------------- */

// Map each score row to the tab where the underlying detail lives, so the row
// is clickable as a shortcut.
const SCORECARD_JUMP: Record<string, TabId> = {
  'Tracking latency': 'latency',
  'Filter group delay': 'latency',
  'Motor balance': 'balance',
  'Noise floor (100-300 Hz)': 'spectrum',
  'Step response (rise)': 'step',
  'Step response (overshoot)': 'step',
  'Battery sag': 'battery',
};

function ScorecardSection({
  entries,
  onJump,
}: {
  entries: LogEntry[];
  onJump: (tab: TabId) => void;
}) {
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;

  const cards = useMemo(() => {
    if (effectiveMerge) {
      return [
        {
          slot: makeMergedSlot(entries),
          scorecard: buildMergedScorecard(entries.map((e) => e.log)),
        },
      ];
    }
    return entries.map(({ slot, log }) => ({ slot, scorecard: buildScorecard(log) }));
  }, [entries, effectiveMerge]);

  return (
    <section className="plot-section">
      <h2>Scorecard</h2>
      <p className="muted">
        {effectiveMerge && `Showing combined scorecard pooled across ${entries.length} logs. `}
        Triage view — green is fine, yellow worth a look, red worth digging into. Click any row to
        jump to the matching tab. Thresholds are rules of thumb for typical FPV builds.
      </p>

      <div className="controls" style={{ marginBottom: '0.5rem' }}>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      {cards.map(({ slot, scorecard }) => (
        <div key={slot.id} className="diff-log">
          <h4 className="diff-log__head">
            {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
            <span className="diff-log__name">{shortName(slot)}</span>
            <ScorecardSummary entries={scorecard.entries} />
          </h4>
          <div className="scorecard-grid">
            {scorecard.entries.map((e) => (
              <ScorecardRow key={e.key} entry={e} onJump={onJump} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ScorecardSummary({ entries }: { entries: ScoreEntry[] }) {
  const counts: Record<ScoreStatus, number> = { good: 0, warn: 0, bad: 0, na: 0 };
  for (const e of entries) counts[e.status]++;
  return (
    <span className="balance-axis-strip">
      {counts.bad > 0 && (
        <span className="balance-tag balance-tag--warn">{counts.bad} bad</span>
      )}
      {counts.warn > 0 && (
        <span
          className="balance-tag"
          style={{ background: 'rgba(255,247,93,0.12)', color: '#fff75d', border: '1px solid rgba(255,247,93,0.35)' }}
        >
          {counts.warn} warn
        </span>
      )}
      {counts.good > 0 && (
        <span className="balance-tag balance-tag--ok">{counts.good} ok</span>
      )}
    </span>
  );
}

function ScorecardRow({
  entry,
  onJump,
}: {
  entry: ScoreEntry;
  onJump: (tab: TabId) => void;
}) {
  const target = SCORECARD_JUMP[entry.key];
  const clickable = target != null;
  return (
    <button
      type="button"
      className={`scorecard-row scorecard-row--${entry.status}${clickable ? '' : ' scorecard-row--static'}`}
      onClick={clickable ? () => onJump(target) : undefined}
      disabled={!clickable}
    >
      <span className={`scorecard-dot scorecard-dot--${entry.status}`} />
      <div className="scorecard-text">
        <span className="scorecard-key">{entry.key}</span>
        <span className="scorecard-value">{entry.value}</span>
        {entry.detail && <span className="scorecard-detail">{entry.detail}</span>}
      </div>
    </button>
  );
}

function TrackingSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;
  return (
    <section className="plot-section">
      <h2>Setpoint vs gyro</h2>
      <p className="muted">
        {multi
          ? 'Setpoint shown once (gray, from primary log). Gyro per log in log color (see sidebar).'
          : 'How well the filtered gyro tracks the stick command. Tighter overlap = tighter tune.'}
      </p>
      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];
        if (multi) {
          // Single shared setpoint reference (primary), gyro per log in log color.
          series.push({
            label: 'Setpoint',
            values: primary.log.setpoint[i]!,
            stroke: '#7a8597',
            width: 1,
          });
          for (const e of entries) {
            series.push({
              label: `${shortName(e.slot)} gyro`,
              values: align(e.log.gyroFilt[i]!, N),
              stroke: colorFor(e.slot),
              width: 1.5,
            });
          }
        } else {
          // Single log: classic axis-color view.
          series.push(
            { label: 'Setpoint', values: primary.log.setpoint[i]!, stroke: '#7a8597', width: 1 },
            { label: 'Gyro', values: primary.log.gyroFilt[i]!, stroke: AXIS_COLORS[i]!, width: 1.5 },
          );
        }
        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            <TimeSeriesPlot time={primary.log.time} series={series} yLabel="deg/s" height={220} />
          </div>
        );
      })}
    </section>
  );
}

function FilteringSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;
  const anyRaw = useMemo(
    () => entries.some(({ log }) => log.gyroRaw.some((arr) => arr.some((v) => v !== 0))),
    [entries],
  );
  if (!anyRaw) {
    return (
      <section className="plot-section">
        <h2>Raw vs filtered gyro</h2>
        <p className="muted">
          Unfiltered gyro is not present in these logs. Enable <code>gyroUnfilt</code> in the
          blackbox <code>debug_mode</code> to see this view.
        </p>
      </section>
    );
  }
  return (
    <section className="plot-section">
      <h2>Raw vs filtered gyro</h2>
      <p className="muted">
        {multi
          ? 'Raw shown once (gray, from primary). Filtered per log in log color (see sidebar).'
          : 'Unfiltered gyro behind the filtered controller input — shows what your gyro filter is removing.'}
      </p>
      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];
        if (multi) {
          const primaryHasRaw = primary.log.gyroRaw[i]!.some((v) => v !== 0);
          if (primaryHasRaw) {
            series.push({
              label: 'Raw (primary)',
              values: primary.log.gyroRaw[i]!,
              stroke: '#5a6473',
              width: 0.75,
            });
          }
          for (const e of entries) {
            series.push({
              label: `${shortName(e.slot)} filtered`,
              values: align(e.log.gyroFilt[i]!, N),
              stroke: colorFor(e.slot),
              width: 1.4,
            });
          }
        } else {
          const hasRaw = primary.log.gyroRaw[i]!.some((v) => v !== 0);
          if (hasRaw) {
            series.push({
              label: 'Raw',
              values: primary.log.gyroRaw[i]!,
              stroke: '#5a6473',
              width: 0.75,
            });
          }
          series.push({
            label: 'Filtered',
            values: primary.log.gyroFilt[i]!,
            stroke: AXIS_COLORS[i]!,
            width: 1.4,
          });
        }
        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            <TimeSeriesPlot time={primary.log.time} series={series} yLabel="deg/s" height={220} />
          </div>
        );
      })}
    </section>
  );
}

type SpectrogramSource = 'filt' | 'raw';
const WINDOW_SIZES = [256, 512, 1024, 2048] as const;

function SpectrogramSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const others = entries.slice(1);
  const [windowSize, setWindowSize] = useState<number>(512);
  const [source, setSource] = useState<SpectrogramSource>('filt');
  const [maxFreq, setMaxFreq] = useState<number>(500);
  const [cursorTime, setCursorTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);

  // Detect whether raw gyro is actually populated (not all zeros).
  const hasRaw = useMemo(() => log.gyroRaw.some((arr) => arr.some((v) => v !== 0)), [log]);
  const effectiveSource: SpectrogramSource = source === 'raw' && !hasRaw ? 'filt' : source;

  const specs = useMemo(() => {
    const rate = log.setup.sampleRateHz;
    // Fixed-time hop (≈ 15 ms) instead of a fixed window-fraction. Keeps the time
    // resolution uniform across window sizes: large windows naturally use more
    // overlap and look just as smooth as small windows.
    const hopSize = Math.max(1, Math.min(windowSize >> 1, Math.round(rate * 0.015)));
    return AXIS_NAMES.map((name, i) => {
      const signal = effectiveSource === 'raw' ? log.gyroRaw[i]! : log.gyroFilt[i]!;
      return { name, data: computeSpectrogram(signal, rate, { windowSize, hopSize }) };
    });
  }, [log, windowSize, effectiveSource]);

  const nyquist = Math.floor(log.setup.sampleRateHz / 2);

  // Common time axis across the three spectrograms (all axes use the same hop).
  const times = specs[0]?.data.times ?? null;
  const tMin = times && times.length > 0 ? times[0]! : 0;
  const tMax = times && times.length > 0 ? times[times.length - 1]! : 0;

  // Default the cursor to the middle of the window once data lands.
  useEffect(() => {
    if (cursorTime == null && times && times.length > 0) {
      setCursorTime((tMin + tMax) / 2);
    }
    if (cursorTime != null && (cursorTime < tMin || cursorTime > tMax)) {
      setCursorTime(times && times.length > 0 ? (tMin + tMax) / 2 : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax]);

  // Playback loop: advance cursor in wall-clock seconds × playSpeed.
  useEffect(() => {
    if (!isPlaying || cursorTime == null || tMax <= tMin) return;
    let raf = 0;
    let lastWall = performance.now();
    let t = cursorTime;
    const tick = (now: number) => {
      const dt = (now - lastWall) / 1000;
      lastWall = now;
      t += dt * playSpeed;
      if (t > tMax) t = tMin + (t - tMax); // wrap around
      setCursorTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playSpeed, tMin, tMax]);

  // Slice per axis at the chosen cursor time.
  const slices = useMemo(() => {
    if (cursorTime == null || !times || times.length === 0) return null;
    // Find the closest time-bin (times is monotonic ascending).
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid]! < cursorTime) lo = mid + 1;
      else hi = mid;
    }
    let bin = lo;
    if (bin > 0 && Math.abs(times[bin - 1]! - cursorTime) < Math.abs(times[bin]! - cursorTime)) {
      bin = bin - 1;
    }
    return specs.map((s, i) => {
      const fb = s.data.freqBins;
      const slice = new Float32Array(fb);
      const base = bin * fb;
      for (let f = 0; f < fb; f++) slice[f] = s.data.magnitudes[base + f]!;
      return {
        name: s.name,
        freq: s.data.frequencies,
        slice,
        color: AXIS_COLORS[i]!,
      };
    });
  }, [specs, cursorTime, times]);

  const sliceSeries: PlotSeries[] = slices
    ? slices.map((s) => ({
        label: s.name,
        values: s.slice,
        stroke: s.color,
        width: 1.4,
      }))
    : [];

  return (
    <section className="plot-section">
      <h2>
        Gyro spectrogram ({effectiveSource === 'raw' ? 'raw' : 'filtered'})
        {others.length > 0 && ` — showing ${shortName(entries[0]!.slot)} only`}
      </h2>
      {others.length > 0 && (
        <p className="muted">
          Heatmaps can&apos;t overlay — showing the first enabled log only. Use the Full spectrum tab to compare logs as line traces.
        </p>
      )}
      <div className="controls">
        <label>
          Signal:
          <select
            value={effectiveSource}
            onChange={(e) => setSource(e.target.value as SpectrogramSource)}
            disabled={!hasRaw}
          >
            <option value="filt">Filtered (gyroADC)</option>
            <option value="raw" disabled={!hasRaw}>Raw (gyroUnfilt){hasRaw ? '' : ' — not logged'}</option>
          </select>
        </label>
        <label>
          Window:
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number.parseInt(e.target.value, 10))}
          >
            {WINDOW_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Max freq:
          <select
            value={maxFreq}
            onChange={(e) => setMaxFreq(Number.parseInt(e.target.value, 10))}
          >
            {[250, 500, 750, 1000, nyquist]
              .filter((v, i, a) => v <= nyquist && a.indexOf(v) === i)
              .map((v) => (
                <option key={v} value={v}>{v} Hz</option>
              ))}
          </select>
        </label>
      </div>

      {times && times.length > 0 && (
        <div className="spec-playback">
          <button
            type="button"
            className="spec-playback__btn"
            onClick={() => setIsPlaying((p) => !p)}
          >
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
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number.parseFloat(e.target.value))}
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      )}

      {slices && slices.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h3 className="axis-plot__title">
            Spectral slice at {cursorTime != null ? `${cursorTime.toFixed(2)} s` : '—'}
          </h3>
          <TimeSeriesPlot
            time={slices[0]!.freq}
            series={sliceSeries}
            yLabel="dB"
            xLabel="Hz"
            xMin={0}
            xMax={maxFreq}
            yMin={-80}
            yMax={0}
            height={180}
          />
        </div>
      )}

      {specs.map((s) => (
        <SpectrogramPlot
          key={s.name}
          data={s.data}
          title={s.name}
          maxFreqHz={maxFreq}
          cursorTime={cursorTime ?? undefined}
        />
      ))}
    </section>
  );
}

function computeAxisSteps(
  log: ParsedLog,
  options: { windowMs?: number; minExcitation?: number } = {},
) {
  const sampTimeUs = log.setup.looptimeUs;
  return AXIS_NAMES.map((name, i) => {
    const setpoint = log.setpoint[i]!;
    const gyro = log.gyroFilt[i]!;
    const result = computeStepResponse(setpoint, gyro, sampTimeUs, options);
    return { name, color: AXIS_COLORS[i]!, ...result };
  });
}

/* ---------------------------- Latency tab ------------------------------ */

interface AxisLatency extends LatencyResult {
  axis: number;
}

function LatencySection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;

  const perLog = useMemo(() => {
    return entries.map(({ slot, log }) => {
      const axes: AxisLatency[] = AXIS_NAMES.map((_n, axis) => {
        const sp = log.setpoint[axis]!;
        const gy = log.gyroFilt[axis]!;
        const r = computeXcorrLatency(sp, gy, log.setup.sampleRateHz);
        return { axis, ...r };
      });
      const view = buildTuneView(log);
      const delays = computeFilterDelays(view);
      return { slot, log, axes, delays };
    });
  }, [entries]);

  return (
    <section className="plot-section">
      <h2>Latency</h2>
      <p className="muted">
        Setpoint→gyro tracking delay via cross-correlation — works on any flight data
        (no clean step needed). The filter breakdown below shows how much of that delay
        is allocated by each filter near DC.
      </p>

      <div className="diff-section">
        <h3>Tracking latency (setpoint → gyro)</h3>
        <table className="diff-table">
          <thead>
            <tr>
              {multi && <th></th>}
              {multi && <th>Log</th>}
              {AXIS_NAMES.map((name, i) => (
                <th key={name}>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perLog.map(({ slot, axes }) => (
              <tr key={slot.id}>
                {multi && (
                  <th>
                    <span className="diff-log__chip" style={{ background: colorFor(slot) }} />
                  </th>
                )}
                {multi && <th>{shortName(slot)}</th>}
                {axes.map((a) => (
                  <td key={a.axis}>
                    <LatencyCell result={a} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          Faded values had low correlation or low stick activity in the window — widen the time
          range or pick a more active flight segment.
        </p>
      </div>

      <div className="diff-section">
        <h3>Filter group delay (near DC)</h3>
        {perLog.map(({ slot, delays }) => (
          <div key={slot.id} className="diff-log">
            <h4 className="diff-log__head">
              {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
              <span className="diff-log__name">{shortName(slot)}</span>
              <span className="diff-log__vs">
                total {delays.totalGroupDelayMs.toFixed(2)} ms
              </span>
            </h4>
            {delays.entries.length === 0 ? (
              <p className="muted">No filters configured.</p>
            ) : (
              <FilterDelayTable entries={delays.entries} />
            )}
          </div>
        ))}
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          Notches contribute ~0 ms at DC — their delay budget hits at the notch center. RPM and
          dynamic notch filters track flight state and aren&apos;t modeled here.
        </p>
      </div>
    </section>
  );
}

function LatencyCell({ result }: { result: LatencyResult }) {
  if (!result.reliable) {
    return (
      <span className="muted" title={`Corr ${result.correlation.toFixed(2)}`}>
        {result.lagMs.toFixed(1)} ms
      </span>
    );
  }
  return (
    <span title={`Correlation ${result.correlation.toFixed(2)}`}>
      {result.lagMs.toFixed(1)} ms
    </span>
  );
}

function FilterDelayTable({ entries }: { entries: FilterDelayEntry[] }) {
  return (
    <table className="diff-table">
      <thead>
        <tr>
          <th>Filter</th>
          <th>Cutoff</th>
          <th>Type</th>
          <th>Group delay</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={`${e.label}-${i}`}>
            <th>{e.label}</th>
            <td>{e.cutoffHz > 0 ? `${e.cutoffHz} Hz` : '—'}{e.dynamic && ' (dyn)'}</td>
            <td className="muted">{e.type}</td>
            <td>{e.groupDelayMs > 0 ? `${e.groupDelayMs.toFixed(2)} ms` : <span className="muted">~0</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StepResponseSection({ entries }: { entries: LogEntry[] }) {
  // Auto-derived excitation floor: scale with the log's peak setpoint so quiet
  // axes (e.g. yaw on a cruise log) aren't gated out by a fixed acro default.
  const autoParams = useMemo(() => {
    let peakSetpoint = 0;
    for (const { log } of entries) {
      for (let axis = 0; axis < 3; axis++) {
        const sp = log.setpoint[axis]!;
        for (let i = 0; i < sp.length; i++) {
          const v = Math.abs(sp[i]!);
          if (v > peakSetpoint) peakSetpoint = v;
        }
      }
    }
    const minExcitation = Math.max(20, Math.min(200, Math.round(peakSetpoint * 0.15)));
    return { windowMs: 1000, minExcitation, peakSetpoint };
  }, [entries]);

  const [windowMs, setWindowMs] = useState<number>(autoParams.windowMs);
  const [minExcitation, setMinExcitation] = useState<number>(autoParams.minExcitation);
  const [mergeLogs, setMergeLogs] = useState(false);
  const [showSegments, setShowSegments] = useState(true);
  // Re-seed defaults when the loaded logs change.
  const lastAutoRef = useRef(autoParams);
  useEffect(() => {
    const last = lastAutoRef.current;
    if (last.windowMs !== autoParams.windowMs || last.minExcitation !== autoParams.minExcitation) {
      setWindowMs(autoParams.windowMs);
      setMinExcitation(autoParams.minExcitation);
      lastAutoRef.current = autoParams;
    }
  }, [autoParams]);

  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;

  const computed = useMemo(() => {
    const perLog = entries.map(({ slot, log, dash }) => ({
      slot,
      dash,
      axes: computeAxisSteps(log, { windowMs, minExcitation }),
    }));
    if (!effectiveMerge) return perLog;
    const mergedAxes = AXIS_NAMES.map((name, i) => ({
      name,
      color: AXIS_COLORS[i]!,
      ...combineStepResponses(perLog.map((p) => p.axes[i]!)),
    }));
    return [{ slot: makeMergedSlot(entries), dash: [], axes: mergedAxes }];
  }, [entries, windowMs, minExcitation, effectiveMerge]);
  const multi = computed.length > 1;

  const anyDetected = computed.some(({ axes }) => axes.some((d) => d.segments.length > 0));

  const diagSummary = useMemo(() => {
    let windowsTotal = 0;
    let windowsLowExcitation = 0;
    let windowsBadSettle = 0;
    let windowsAccepted = 0;
    let peakSetpoint = 0;
    for (const c of computed) {
      for (const a of c.axes) {
        windowsTotal += a.diagnostics.windowsTotal;
        windowsLowExcitation += a.diagnostics.windowsLowExcitation;
        windowsBadSettle += a.diagnostics.windowsBadSettle;
        windowsAccepted += a.diagnostics.windowsAccepted;
        peakSetpoint = Math.max(peakSetpoint, a.diagnostics.peakSetpoint);
      }
    }
    return { windowsTotal, windowsLowExcitation, windowsBadSettle, windowsAccepted, peakSetpoint };
  }, [computed]);

  return (
    <section className="plot-section">
      <h2>Step response</h2>
      <p className="muted">
        {effectiveMerge && `Pooling segments from ${entries.length} logs into one mean. `}
        {multi && 'Each log uses its own dash pattern. '}
        Per-axis normalized step response, computed by Wiener deconvolution of setpoint → gyro
        over overlapping windows. Faint lines are per-window estimates; the bold line is the mean.
      </p>

      <div className="controls" style={{ flexWrap: 'wrap' }}>
        <label>
          Window length:
          <input
            type="range"
            min={250}
            max={3000}
            step={50}
            value={windowMs}
            onChange={(e) => setWindowMs(Number.parseInt(e.target.value, 10))}
            style={{ width: '12rem' }}
          />
          <input
            type="number"
            min={100}
            max={5000}
            step={50}
            value={windowMs}
            onChange={(e) => setWindowMs(Number.parseInt(e.target.value, 10) || 0)}
            style={{ width: '5rem' }}
          />
          <span className="muted" style={{ marginLeft: '0.3rem' }}>ms</span>
        </label>
        <label>
          Min excitation:
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={minExcitation}
            onChange={(e) => setMinExcitation(Number.parseInt(e.target.value, 10))}
            style={{ width: '10rem' }}
          />
          <input
            type="number"
            min={1}
            max={1000}
            step={5}
            value={minExcitation}
            onChange={(e) => setMinExcitation(Number.parseInt(e.target.value, 10) || 0)}
            style={{ width: '4.5rem' }}
          />
          <span className="muted" style={{ marginLeft: '0.3rem' }}>deg/s</span>
        </label>
        <button
          type="button"
          onClick={() => {
            setWindowMs(autoParams.windowMs);
            setMinExcitation(autoParams.minExcitation);
          }}
          className="step-btn-reset"
          title={`Auto-derived from log peak setpoint of ${autoParams.peakSetpoint.toFixed(0)} deg/s`}
        >
          Auto ({autoParams.windowMs} ms / {autoParams.minExcitation})
        </button>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
          }}
          title="Hide the faint per-segment shadow lines and show only the bold mean."
        >
          <input
            type="checkbox"
            checked={showSegments}
            onChange={(e) => setShowSegments(e.target.checked)}
          />
          Show segments
        </label>
      </div>
      <p className="muted" style={{ fontSize: '0.78rem', marginTop: '-0.2rem' }}>
        <strong>Window length</strong>: longer windows give better low-frequency resolution but
        fewer averages. <strong>Min excitation</strong>: windows with peak |setpoint| below this
        skip — no stick activity, nothing to deconvolve. Scales off your log&apos;s peak setpoint
        ({autoParams.peakSetpoint.toFixed(0)} deg/s here).
      </p>

      <div className="step-diag">
        <span className="step-diag__item">
          <span className="step-diag__k">accepted</span>
          <span className="step-diag__v">{diagSummary.windowsAccepted}</span>
        </span>
        <span className="step-diag__sep">←</span>
        <span className="step-diag__item">
          <span className="step-diag__k">windows</span>
          <span className="step-diag__v">{diagSummary.windowsTotal}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">skipped (low excitation)</span>
          <span className="step-diag__v">{diagSummary.windowsLowExcitation}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">rejected (bad settle)</span>
          <span className="step-diag__v">{diagSummary.windowsBadSettle}</span>
        </span>
        <span className="step-diag__item">
          <span className="step-diag__k">peak setpoint</span>
          <span className="step-diag__v">{diagSummary.peakSetpoint.toFixed(0)}</span>
        </span>
      </div>

      {!anyDetected && (
        <p className="muted">
          No usable windows. If <strong>windows</strong> above is 0, the time range is too short
          for the chosen window length — widen the range or shorten the window. Otherwise the
          excitation threshold may be too high for this axis — lower it.
        </p>
      )}
      {AXIS_NAMES.map((_name, i) => (
        <StepResponseAxisPanel
          key={AXIS_NAMES[i]}
          axisIndex={i}
          perLog={computed.map((c) => ({ slot: c.slot, dash: c.dash, data: c.axes[i]! }))}
          showSegments={showSegments}
        />
      ))}
    </section>
  );
}

interface AxisStepData {
  name: string;
  color: string;
  time: Float32Array;
  segments: Float32Array[];
  rejectedSegments: Float32Array[];
  mean: Float32Array;
  metrics: import('./dsp/stepResponse').StepMetrics;
  diagnostics: import('./dsp/stepResponse').StepDiagnostics;
}

interface AxisStepWithSlot {
  slot: LogSlot;
  dash: number[];
  data: AxisStepData;
}

function StepResponseAxisPanel({
  axisIndex,
  perLog,
  showSegments,
}: {
  axisIndex: number;
  perLog: AxisStepWithSlot[];
  showSegments: boolean;
}) {
  const axisColor = AXIS_COLORS[axisIndex]!;
  const axisName = AXIS_NAMES[axisIndex]!;
  const primary = perLog.find((p) => p.data.time.length > 0) ?? perLog[0]!;
  const time = primary.data.time;
  const multi = perLog.length > 1;

  const series = useMemo<PlotSeries[]>(() => {
    const out: PlotSeries[] = [];
    for (let idx = 0; idx < perLog.length; idx++) {
      const { slot, data } = perLog[idx]!;
      if (data.mean.length === 0) continue;
      if (multi) {
        // Multi: log color, no segments.
        out.push({
          label: `${shortName(slot)} mean`,
          values: align(data.mean, time.length),
          stroke: colorFor(slot),
          width: 2,
        });
      } else {
        // Single: optional faint per-segment shadows behind the axis-color mean.
        if (showSegments) {
          const segColor = hexWithAlpha(axisColor, 0.18);
          for (const seg of data.segments) {
            out.push({ label: '', values: seg, stroke: segColor, width: 0.6 });
          }
        }
        out.push({
          label: 'Mean',
          values: data.mean,
          stroke: axisColor,
          width: 2,
        });
      }
    }
    return out;
  }, [perLog, time.length, axisColor, multi, showSegments]);

  const empty = perLog.every((p) => p.data.mean.length === 0);

  const peakDots: LogDot[] = perLog.map((p) => ({
    label: shortName(p.slot),
    color: colorFor(p.slot),
    value: p.data.metrics.peakResponse,
  }));
  const latencyDots: LogDot[] = perLog.map((p) => ({
    label: shortName(p.slot),
    color: colorFor(p.slot),
    value: p.data.metrics.latencyHalfMs,
  }));

  return (
    <div className="axis-plot">
      <h3 className="axis-plot__title">
        <span className="axis-plot__dot" style={{ background: axisColor }} />
        {axisName}
        {perLog.map((p, idx) => (
          <span key={p.slot.id} className={`step-metrics${idx === 0 ? '' : ' step-metrics--b'}`}>
            {multi && (
              <span className="muted" style={{ marginRight: '0.4rem' }}>
                {shortName(p.slot)}:
              </span>
            )}
            <span className="step-metrics__item">
              <span className="step-metrics__k">n</span>
              {p.data.segments.length}
            </span>
            <span className="step-metrics__item">
              <span className="step-metrics__k">rise</span>
              {p.data.metrics.riseTimeMs != null ? `${p.data.metrics.riseTimeMs.toFixed(1)} ms` : '—'}
            </span>
            <span className="step-metrics__item">
              <span className="step-metrics__k">over</span>
              {p.data.metrics.overshootPct != null ? `${p.data.metrics.overshootPct.toFixed(1)}%` : '—'}
            </span>
            <span className="step-metrics__item">
              <span className="step-metrics__k">settle</span>
              {p.data.metrics.settlingTimeMs != null ? `${p.data.metrics.settlingTimeMs.toFixed(1)} ms` : '—'}
            </span>
            <span className="step-metrics__item">
              <span className="step-metrics__k">50%</span>
              {p.data.metrics.latencyHalfMs != null ? `${p.data.metrics.latencyHalfMs.toFixed(1)} ms` : '—'}
            </span>
          </span>
        ))}
      </h3>
      <div className="step-axis-row">
        {!empty ? (
          <div className="step-axis-row__plot">
            <TimeSeriesPlot
              time={time}
              series={series}
              yLabel="normalized"
              xLabel="ms"
              height={220}
              // Cap Y at 1.5 so a handful of overshooting segments don't squash
              // the mean — anything above is visually clipped, not removed.
              yMin={0}
              yMax={1.5}
              showLegend={false}
            />
          </div>
        ) : (
          <p className="muted step-axis-row__plot">No step events detected on this axis.</p>
        )}
        <div className="step-axis-row__dots">
          <LogDotPlot
            dots={peakDots}
            title={`${axisName} peak`}
            referenceY={1}
            yMin={0.8}
            yMax={1.4}
            height={220}
          />
          <LogDotPlot
            dots={latencyDots}
            title={`${axisName} 50% latency`}
            unit="ms"
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

function StepMetricsBadges({
  metrics,
  count,
}: {
  metrics: import('./dsp/stepResponse').StepMetrics;
  count: number;
}) {
  return (
    <span className="step-metrics">
      <span className="step-metrics__item"><span className="step-metrics__k">n</span>{count}</span>
      <span className="step-metrics__item">
        <span className="step-metrics__k">rise</span>
        {metrics.riseTimeMs != null ? `${metrics.riseTimeMs.toFixed(1)} ms` : '—'}
      </span>
      <span className="step-metrics__item">
        <span className="step-metrics__k">overshoot</span>
        {metrics.overshootPct != null ? `${metrics.overshootPct.toFixed(1)}%` : '—'}
      </span>
      <span className="step-metrics__item">
        <span className="step-metrics__k">settle</span>
        {metrics.settlingTimeMs != null ? `${metrics.settlingTimeMs.toFixed(1)} ms` : '—'}
      </span>
    </span>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = Number.parseInt(c.substring(0, 2), 16);
  const g = Number.parseInt(c.substring(2, 4), 16);
  const b = Number.parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function LogSummary({ log }: { log: ParsedLog }) {
  const durationSec = log.time[log.time.length - 1] ?? 0;
  const { setup } = log;
  return (
    <section className="summary">
      <h2>{log.fileName}</h2>
      <dl>
        <dt>Firmware</dt>
        <dd>{setup.firmwareKind} {setup.firmwareVersion}</dd>
        {setup.craftName && (
          <>
            <dt>Craft</dt>
            <dd>{setup.craftName}</dd>
          </>
        )}
        <dt>Log</dt>
        <dd>{log.logIndex + 1} of {log.logCount}</dd>
        <dt>Duration</dt>
        <dd>{durationSec.toFixed(2)} s</dd>
        <dt>Samples</dt>
        <dd>{log.time.length.toLocaleString()}</dd>
        <dt>Sample rate</dt>
        <dd>{setup.sampleRateHz.toLocaleString()} Hz (looptime {setup.looptimeUs} µs)</dd>
        <dt>Motors</dt>
        <dd>{log.motor.length}</dd>
      </dl>
    </section>
  );
}
