import { AXIS_NAMES } from '../../constants';
import type { ParsedLog, Scorecard, ScoreEntry } from '../../types';
import { analyzeBattery } from '../analyzeBattery';
import { analyzeMotorBalance } from '../balance/analyzeMotorBalance';
import { filterDelaysForLog } from '../filters/filterDelaysForLog';
import { latencyForLog } from '../latencyForLog';
import { computePsd } from '../spectrum/computePsd';
import { stepResponseForLog } from '../step/stepResponseForLog';
import { stepScoreEntries } from '../step/stepScoreEntries';
import { balanceEntry } from './balanceEntry';
import { batteryEntry } from './batteryEntry';
import { filterDelayEntry } from './filterDelayEntry';
import { latencyEntry } from './latencyEntry';
import { noiseFloorEntry } from './noiseFloorEntry';

export function buildScorecard(log: ParsedLog): Scorecard {
  const entries: ScoreEntry[] = [];

  // ---- Tracking latency (per axis, xcorr) ----
  const latencies = AXIS_NAMES.map((_n, axis) => latencyForLog(log, axis));
  entries.push(latencyEntry(latencies));

  // ---- Gyro filter delay in the control band ----
  const delays = filterDelaysForLog(log);
  entries.push(
    filterDelayEntry(delays.gyroDelayMs, delays.referenceHz, delays.entries.filter((e) => e.chain === 'gyro').length),
  );

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
  const steps = AXIS_NAMES.map((_n, axis) => stepResponseForLog(log, axis));
  const stepRows = stepScoreEntries(steps);
  for (const row of stepRows) entries.push(row);

  // ---- Battery sag ----
  const battery = analyzeBattery(log);
  const batteryRow = batteryEntry(battery);
  if (batteryRow) entries.push(batteryRow);

  return { entries };
}
