import { AXIS_NAMES } from '../axes';
import type { ParsedLog } from '../types';
import { buildTuneView } from '../tuneView';
import { analyzeBattery, type BatteryAnalysis } from './battery';
import { computeFilterDelays, computeXcorrLatency, type LatencyResult } from './latency';
import { analyzeMotorBalance, combineMotorBalances, type BalanceAnalysis } from './motorBalance';
import { combinePsds, computePsd } from './spectrogram';
import { combineStepResponses, computeStepResponse, type StepResponseResult } from './stepResponse';

export type ScoreStatus = 'good' | 'warn' | 'bad' | 'na';

export interface ScoreEntry {
  /** Display name. */
  key: string;
  status: ScoreStatus;
  /** Primary value(s) to surface (e.g., "18.5 / 22.3 / 15 ms"). */
  value: string;
  /** One-line context shown beneath the value. */
  detail?: string;
}

export interface Scorecard {
  entries: ScoreEntry[];
}

/**
 * Roll-up of every metric we already compute, with a green/yellow/red status
 * per row based on practical thresholds. Designed as a triage view — open this
 * tab first, then dive into the specific tab for any row that's not green.
 */
// Yaw is excluded from the latency / step rating: most pilots don't actively
// tune yaw and quiet yaw on a fixed-camera log gives noisy values that would
// unfairly drag the score down.
const RATED_AXES = [0, 1] as const;

export function buildScorecard(log: ParsedLog): Scorecard {
  const entries: ScoreEntry[] = [];
  const tune = buildTuneView(log);

  // ---- Tracking latency (per axis, xcorr) ----
  const latencies = AXIS_NAMES.map((_n, axis) =>
    computeXcorrLatency(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.sampleRateHz),
  );
  entries.push(latencyEntry(latencies));

  // ---- Filter group delay near DC ----
  const delays = computeFilterDelays(tune);
  entries.push(filterDelayEntry(delays.totalGroupDelayMs, delays.entries.length));

  // ---- Motor balance ----
  const balance = analyzeMotorBalance(log);
  const balanceRow = balanceEntry(balance);
  if (balanceRow) entries.push(balanceRow);

  // ---- Noise floor (filtered gyro PSD) ----
  if (log.gyroFilt[0]!.length > 256) {
    const psds = AXIS_NAMES.map((_n, axis) =>
      computePsd(log.gyroFilt[axis]!, log.setup.sampleRateHz, { windowSize: 1024 }),
    );
    const noiseRow = noiseFloorEntry(psds);
    if (noiseRow) entries.push(noiseRow);
  }

  // ---- Step response (only if any axis detected steps) ----
  const steps = AXIS_NAMES.map((_n, axis) =>
    computeStepResponse(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.looptimeUs),
  );
  const stepRows = stepResponseEntries(steps);
  for (const row of stepRows) entries.push(row);

  // ---- Battery sag ----
  const battery = analyzeBattery(log);
  const batteryRow = batteryEntry(battery);
  if (batteryRow) entries.push(batteryRow);

  return { entries };
}

/**
 * Pooled scorecard across N logs. Uses the same merge primitives the other
 * tabs do (combineStepResponses, combineMotorBalances, combinePsds) so the
 * pooled values shown here match the pooled charts shown in the matching tab
 * when you toggle their "Merge logs" too.
 */
export function buildMergedScorecard(logs: ParsedLog[]): Scorecard {
  if (logs.length === 0) return { entries: [] };
  if (logs.length === 1) return buildScorecard(logs[0]!);

  const entries: ScoreEntry[] = [];
  const reference = logs[0]!;
  const tune = buildTuneView(reference);

  // ---- Tracking latency: average reliable per-axis lags across logs ----
  const meanLatencies: LatencyResult[] = AXIS_NAMES.map((_n, axis) => {
    const perLog = logs.map((l) =>
      computeXcorrLatency(l.setpoint[axis]!, l.gyroFilt[axis]!, l.setup.sampleRateHz),
    );
    const reliable = perLog.filter((l) => l.reliable);
    if (reliable.length === 0) {
      return { lagMs: 0, correlation: 0, reliable: false };
    }
    const lagMs = reliable.reduce((s, l) => s + l.lagMs, 0) / reliable.length;
    const correlation = reliable.reduce((s, l) => s + l.correlation, 0) / reliable.length;
    return { lagMs, correlation, reliable: true };
  });
  entries.push(latencyEntry(meanLatencies));

  // ---- Filter group delay: configuration-only, all logs share it ----
  const delays = computeFilterDelays(tune);
  entries.push(filterDelayEntry(delays.totalGroupDelayMs, delays.entries.length));

  // ---- Motor balance: pool via combineMotorBalances ----
  const balances = logs.map((l) => analyzeMotorBalance(l));
  const balanceRow = balanceEntry(combineMotorBalances(balances));
  if (balanceRow) entries.push(balanceRow);

  // ---- Noise floor: pool per-axis PSDs, take mid-band mean ----
  if (reference.gyroFilt[0]!.length > 256) {
    const pooledPsds = AXIS_NAMES.map((_n, axis) =>
      combinePsds(
        logs.map((l) => computePsd(l.gyroFilt[axis]!, l.setup.sampleRateHz, { windowSize: 1024 })),
      ),
    );
    const noiseRow = noiseFloorEntry(pooledPsds);
    if (noiseRow) entries.push(noiseRow);
  }

  // ---- Step response: pool segments per axis via combineStepResponses ----
  const pooledSteps: StepResponseResult[] = AXIS_NAMES.map((_n, axis) =>
    combineStepResponses(
      logs.map((l) =>
        computeStepResponse(l.setpoint[axis]!, l.gyroFilt[axis]!, l.setup.looptimeUs),
      ),
    ),
  );
  for (const row of stepResponseEntries(pooledSteps)) entries.push(row);

  // ---- Battery sag: average per-log analyses where battery was logged ----
  const batteries = logs.map((l) => analyzeBattery(l)).filter((b) => b.hasVoltage);
  if (batteries.length > 0) {
    const batteryRow = batteryEntry(averageBatteries(batteries));
    if (batteryRow) entries.push(batteryRow);
  }

  return { entries };
}

/* ------------------------------ Row builders ------------------------------ */

function latencyEntry(latencies: LatencyResult[]): ScoreEntry {
  const reliable = RATED_AXES.map((i) => latencies[i]!).filter((l) => l.reliable);
  if (reliable.length === 0) {
    return {
      key: 'Tracking latency',
      status: 'na',
      value: '—',
      detail: 'No stick activity in the window',
    };
  }
  const max = Math.max(...reliable.map((l) => l.lagMs));
  const status: ScoreStatus = max < 25 ? 'good' : max < 45 ? 'warn' : 'bad';
  return {
    key: 'Tracking latency',
    status,
    value:
      RATED_AXES
        .map((i) => `${AXIS_NAMES[i]} ${latencies[i]!.reliable ? latencies[i]!.lagMs.toFixed(1) : '—'}`)
        .join(' · ') + ' ms',
    detail: 'Setpoint → gyro delay (cross-correlation)',
  };
}

function filterDelayEntry(totalDelayMs: number, filterCount: number): ScoreEntry {
  const status: ScoreStatus =
    totalDelayMs < 2.5 ? 'good' : totalDelayMs < 5 ? 'warn' : 'bad';
  return {
    key: 'Filter group delay',
    status,
    value: `${totalDelayMs.toFixed(2)} ms total`,
    detail: `${filterCount} configured filter${filterCount === 1 ? '' : 's'}`,
  };
}

function balanceEntry(balance: BalanceAnalysis): ScoreEntry | null {
  if (balance.axes.length > 0) {
    const worst = Math.max(...balance.axes.map((a) => Math.abs(a.deltaPct)));
    const status: ScoreStatus =
      worst < 2 ? 'good' : worst < 6 ? 'warn' : 'bad';
    return {
      key: 'Motor balance',
      status,
      value: balance.axes
        .map((a) => `${a.axis} ${a.deltaPct >= 0 ? '+' : ''}${a.deltaPct.toFixed(1)}%`)
        .join(' · '),
      detail:
        balance.singleMotorOutlier != null
          ? `M${balance.singleMotorOutlier.motorIndex + 1} outlier (${balance.singleMotorOutlier.deltaPct.toFixed(1)}%)`
          : balance.dominantAxis != null
          ? `${balance.dominantAxis} is the dominant imbalance axis`
          : 'No dominant axis',
    };
  }
  if (balance.singleMotorOutlier != null) {
    return {
      key: 'Motor balance',
      status: 'warn',
      value: `M${balance.singleMotorOutlier.motorIndex + 1} outlier`,
      detail: `${balance.singleMotorOutlier.deltaPct.toFixed(1)}% from neighbors`,
    };
  }
  return null;
}

function noiseFloorEntry(psds: { frequencies: Float32Array; psdDb: Float32Array }[]): ScoreEntry | null {
  let sum = 0;
  let n = 0;
  for (const p of psds) {
    for (let i = 0; i < p.frequencies.length; i++) {
      const f = p.frequencies[i]!;
      if (f < 100 || f >= 300) continue;
      sum += p.psdDb[i]!;
      n++;
    }
  }
  const midBandMean = n > 0 ? sum / n : Number.NaN;
  if (!Number.isFinite(midBandMean)) return null;
  const status: ScoreStatus =
    midBandMean < 5 ? 'good' : midBandMean < 15 ? 'warn' : 'bad';
  return {
    key: 'Noise floor (100-300 Hz)',
    status,
    value: `${midBandMean.toFixed(1)} dB mean`,
    detail: 'Filtered gyro across roll/pitch/yaw',
  };
}

function stepResponseEntries(steps: StepResponseResult[]): ScoreEntry[] {
  const anyDetected = steps.some((s) => s.segments.length > 0);
  if (!anyDetected) return [];

  const out: ScoreEntry[] = [];
  const risePerAxis = steps.map((s) => s.metrics.riseTimeMs);
  const validRise = RATED_AXES
    .map((i) => risePerAxis[i])
    .filter((x): x is number => x != null);
  if (validRise.length > 0) {
    const maxRise = Math.max(...validRise);
    const status: ScoreStatus = maxRise < 30 ? 'good' : maxRise < 50 ? 'warn' : 'bad';
    out.push({
      key: 'Step response (rise)',
      status,
      value:
        RATED_AXES
          .map((i) => `${AXIS_NAMES[i]} ${risePerAxis[i] != null ? risePerAxis[i]!.toFixed(1) : '—'}`)
          .join(' · ') + ' ms',
      detail: `${steps.reduce((a, s) => a + s.segments.length, 0)} step windows analyzed`,
    });
  }

  const overshoots = steps.map((s) => s.metrics.overshootPct);
  const validOver = RATED_AXES
    .map((i) => overshoots[i])
    .filter((x): x is number => x != null);
  if (validOver.length > 0) {
    const maxOver = Math.max(...validOver);
    const status: ScoreStatus = maxOver < 10 ? 'good' : maxOver < 20 ? 'warn' : 'bad';
    out.push({
      key: 'Step response (overshoot)',
      status,
      value:
        RATED_AXES
          .map((i) => `${AXIS_NAMES[i]} ${overshoots[i] != null ? overshoots[i]!.toFixed(1) : '—'}`)
          .join(' · ') + '%',
    });
  }
  return out;
}

function batteryEntry(battery: BatteryAnalysis): ScoreEntry | null {
  if (!battery.hasVoltage) return null;
  let status: ScoreStatus = 'na';
  let value = '—';
  if (battery.perCellMin != null) {
    status =
      battery.perCellMin >= 3.5 ? 'good'
        : battery.perCellMin >= 3.3 ? 'warn'
        : 'bad';
    value = `${battery.perCellMin.toFixed(2)} V/cell min`;
  } else if (battery.voltageMin != null) {
    value = `${battery.voltageMin.toFixed(2)} V min`;
    status = 'na';
  }
  return {
    key: 'Battery sag',
    status,
    value,
    detail:
      battery.sagUnderLoadV != null
        ? `Mean sag under load ${battery.sagUnderLoadV.toFixed(2)} V` +
          (battery.mAhUsed != null ? ` · ${battery.mAhUsed.toFixed(0)} mAh used` : '')
        : undefined,
  };
}

/** Pool battery analyses by averaging the fields the scorecard reads. */
function averageBatteries(batteries: BatteryAnalysis[]): BatteryAnalysis {
  const mean = (pick: (b: BatteryAnalysis) => number | null) => {
    const xs = batteries.map(pick).filter((x): x is number => x != null);
    return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const sum = (pick: (b: BatteryAnalysis) => number | null) => {
    const xs = batteries.map(pick).filter((x): x is number => x != null);
    return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) : null;
  };
  return {
    hasVoltage: true,
    hasCurrent: batteries.some((b) => b.hasCurrent),
    cellCount: batteries[0]?.cellCount ?? null,
    voltageStart: mean((b) => b.voltageStart),
    voltageEnd: mean((b) => b.voltageEnd),
    voltageMin: mean((b) => b.voltageMin),
    voltageMax: mean((b) => b.voltageMax),
    sagUnderLoadV: mean((b) => b.sagUnderLoadV),
    perCellMin: mean((b) => b.perCellMin),
    perCellEnd: mean((b) => b.perCellEnd),
    meanCurrentA: mean((b) => b.meanCurrentA),
    peakCurrentA: mean((b) => b.peakCurrentA),
    mAhUsed: sum((b) => b.mAhUsed),
    rmsCurrentA: mean((b) => b.rmsCurrentA),
  };
}
