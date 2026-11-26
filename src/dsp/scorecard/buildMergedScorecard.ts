import { AXIS_NAMES } from '../../constants';
import type { BatteryAnalysis, LatencyResult, ParsedLog, Scorecard, ScoreEntry, StepResponseResult } from '../../types';
import { analyzeBattery } from '../analyzeBattery';
import { analyzeMotorBalance } from '../balance/analyzeMotorBalance';
import { balanceEntry } from './balanceEntry';
import { batteryEntry } from './batteryEntry';
import { buildScorecard } from './buildScorecard';
import { combineMotorBalances } from '../balance/combineMotorBalances';
import { combinePsds } from '../spectrum/combinePsds';
import { combineStepResponses } from '../step/combineStepResponses';
import { computePsd } from '../spectrum/computePsd';
import { filterDelayEntry } from './filterDelayEntry';
import { filterDelaysForLog } from '../filters/filterDelaysForLog';
import { latencyEntry } from './latencyEntry';
import { latencyForLog } from '../latencyForLog';
import { noiseFloorEntry } from './noiseFloorEntry';
import { stepResponseForLog } from '../step/stepResponseForLog';
import { stepScoreEntries } from '../step/stepScoreEntries';

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

  // ---- Tracking latency: average reliable per-axis lags across logs ----
  const meanLatencies: LatencyResult[] = AXIS_NAMES.map((_n, axis) => {
    const perLog = logs.map((l) => latencyForLog(l, axis));
    const reliable = perLog.filter((l) => l.reliable);
    if (reliable.length === 0) {
      return { lagMs: 0, correlation: 0, reliable: false };
    }
    const lagMs = reliable.reduce((s, l) => s + l.lagMs, 0) / reliable.length;
    const correlation = reliable.reduce((s, l) => s + l.correlation, 0) / reliable.length;
    return { lagMs, correlation, reliable: true };
  });
  entries.push(latencyEntry(meanLatencies));

  // ---- Gyro filter delay: configuration-only, the first log stands for all ----
  const delays = filterDelaysForLog(reference);
  entries.push(
    filterDelayEntry(delays.gyroDelayMs, delays.referenceHz, delays.entries.filter((e) => e.chain === 'gyro').length),
  );

  // ---- Motor balance: pool via combineMotorBalances ----
  const balances = logs.map((l) => analyzeMotorBalance(l));
  const balanceRow = balanceEntry(combineMotorBalances(balances));
  if (balanceRow) entries.push(balanceRow);

  // ---- Noise floor: pool per-axis PSDs, take mid-band mean ----
  if (reference.gyroFilt[0]!.length > 256) {
    const pooledPsds = AXIS_NAMES.map((_n, axis) =>
      combinePsds(logs.map((l) => computePsd(l.gyroFilt[axis]!, l.setup.sampleRateHz, { windowSize: 1024 }))),
    );
    const noiseRow = noiseFloorEntry(pooledPsds);
    if (noiseRow) entries.push(noiseRow);
  }

  // ---- Step response: pool segments per axis via combineStepResponses ----
  const pooledSteps: StepResponseResult[] = AXIS_NAMES.map((_n, axis) =>
    combineStepResponses(logs.map((l) => stepResponseForLog(l, axis))),
  );
  for (const row of stepScoreEntries(pooledSteps)) entries.push(row);

  // ---- Battery sag: average per-log analyses where battery was logged ----
  const batteries = logs.map((l) => analyzeBattery(l)).filter((b) => b.hasVoltage);
  if (batteries.length > 0) {
    const batteryRow = batteryEntry(averageBatteries(batteries));
    if (batteryRow) entries.push(batteryRow);
  }

  return { entries };
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
    sagAtPeakV: mean((b) => b.sagAtPeakV),
    internalResistanceMohm: mean((b) => b.internalResistanceMohm),
    perCellMin: mean((b) => b.perCellMin),
    perCellEnd: mean((b) => b.perCellEnd),
    meanCurrentA: mean((b) => b.meanCurrentA),
    peakCurrentA: mean((b) => b.peakCurrentA),
    mAhUsed: sum((b) => b.mAhUsed),
    rmsCurrentA: mean((b) => b.rmsCurrentA),
  };
}
