import type { BatteryAnalysis, ParsedLog, SlowFrameSeries } from '../types';
import { median } from '../utils/median';

type VoltageStats = Pick<
  BatteryAnalysis,
  'voltageStart' | 'voltageEnd' | 'voltageMin' | 'voltageMax' | 'cellCount' | 'perCellMin' | 'perCellEnd'
>;

type CurrentStats = Pick<BatteryAnalysis, 'meanCurrentA' | 'peakCurrentA' | 'rmsCurrentA' | 'mAhUsed'>;

const NO_VOLTAGE: VoltageStats = {
  voltageStart: null,
  voltageEnd: null,
  voltageMin: null,
  voltageMax: null,
  cellCount: null,
  perCellMin: null,
  perCellEnd: null,
};

const NO_CURRENT: CurrentStats = { meanCurrentA: null, peakCurrentA: null, rmsCurrentA: null, mAhUsed: null };

/**
 * Battery + current analytics. Slow frames in Betaflight tick at a few Hz, so
 * we integrate with the actual frame timestamps (not assumed uniform rate).
 * Cell count follows Betaflight: floor(resting voltage / max cell voltage) + 1,
 * with the resting voltage the median of the first second.
 * Sag comes from the pack's internal resistance R, fitted as
 * V = a + b·t − R·I so the slow discharge over the flight isn't counted as sag.
 */
export function analyzeBattery(log: ParsedLog): BatteryAnalysis {
  const slow = log.slow;
  const hasVoltage = hasValid(slow.vbat);
  const hasCurrent = hasValid(slow.amperage);
  const voltage = hasVoltage ? voltageStats(log) : NO_VOLTAGE;
  const current = hasCurrent ? currentStats(slow) : NO_CURRENT;
  const resistance = hasVoltage && hasCurrent ? fitInternalResistance(slow) : null;
  const peakCurrentA = current.peakCurrentA;
  const sagUnderLoadV = resistance != null ? resistance * highLoadCurrent(slow.amperage) : null;
  const sagAtPeakV = resistance != null && peakCurrentA != null ? resistance * peakCurrentA : null;

  return {
    hasVoltage,
    hasCurrent,
    cellCount: voltage.cellCount,
    voltageStart: voltage.voltageStart,
    voltageEnd: voltage.voltageEnd,
    voltageMin: voltage.voltageMin,
    voltageMax: voltage.voltageMax,
    sagUnderLoadV,
    sagAtPeakV,
    internalResistanceMohm: resistance != null ? resistance * 1000 : null,
    perCellMin: voltage.perCellMin,
    perCellEnd: voltage.perCellEnd,
    meanCurrentA: current.meanCurrentA,
    peakCurrentA,
    rmsCurrentA: current.rmsCurrentA,
    mAhUsed: current.mAhUsed,
  };
}

function voltageStats(log: ParsedLog): VoltageStats {
  const slow = log.slow;
  const readings: { t: number; v: number }[] = [];

  for (let i = 0; i < slow.vbat.length; i++) {
    const x = slow.vbat[i]!;
    if (Number.isFinite(x) && x > 0) readings.push({ t: slow.time[i] ?? 0, v: x });
  }

  if (readings.length === 0) return NO_VOLTAGE;

  // Half-second median filter: single-sample glitches would otherwise set the min and max.
  const smooth = medianFilter(
    readings.map((r) => r.v),
    halfSecondWidth(readings),
  );
  const rest = median(readings.filter((r) => r.t - readings[0]!.t <= 1).map((r) => r.v));
  const vMin = Math.min(...smooth);
  const voltageEnd = smooth[smooth.length - 1]!;
  const c = Math.floor(rest / maxCellVoltage(log)) + 1;
  const cellsKnown = c >= 1 && c <= 12;

  return {
    voltageStart: readings[0]!.v,
    voltageEnd,
    voltageMin: vMin,
    voltageMax: Math.max(...smooth),
    cellCount: cellsKnown ? c : null,
    perCellMin: cellsKnown ? vMin / c : null,
    perCellEnd: cellsKnown ? voltageEnd / c : null,
  };
}

function currentStats(slow: SlowFrameSeries): CurrentStats {
  const a = slow.amperage;
  const t = slow.time;
  let sum = 0;
  let sumSq = 0;
  let peak = -Infinity;
  let n = 0;
  let charge = 0; // amp-seconds

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    if (!Number.isFinite(ai)) continue;
    sum += ai;
    sumSq += ai * ai;
    if (ai > peak) peak = ai;
    n++;
    if (i > 0) charge += trapezoidCharge(a, t, i);
  }

  if (n === 0) return NO_CURRENT;

  return {
    meanCurrentA: sum / n,
    peakCurrentA: peak,
    rmsCurrentA: Math.sqrt(sumSq / n),
    mAhUsed: charge / 3.6, // A·s → mAh
  };
}

/** Charge between samples i−1 and i (A·s), or 0 across a suspicious gap or a missing previous reading. */
function trapezoidCharge(a: Float32Array, t: Float32Array, i: number): number {
  const dt = t[i]! - t[i - 1]!;
  if (!(dt > 0 && dt < 5) /* clamp suspicious gaps */) return 0;

  const ap = a[i - 1]!;

  return Number.isFinite(ap) ? ((a[i]! + ap) / 2) * dt : 0;
}

function halfSecondWidth(readings: { t: number }[]): number {
  const span = readings[readings.length - 1]!.t - readings[0]!.t;
  const rate = span > 0 ? (readings.length - 1) / span : 10;

  return Math.max(1, Math.round(rate * 0.5)) | 1;
}

function medianFilter(x: number[], width: number): number[] {
  const half = width >> 1;

  return x.map((_, i) => median(x.slice(Math.max(0, i - half), Math.min(x.length, i + half + 1))));
}

/** Betaflight's maximum cell voltage from `vbatcellvoltage` (min,warning,max in 0.01 V); 4.30 V by default. */
function maxCellVoltage(log: ParsedLog): number {
  const max = Number.parseFloat((log.setup.rawHeaders.vbatcellvoltage ?? '').split(',')[2] ?? '');

  return Number.isFinite(max) && max > 0 ? max / 100 : 4.3;
}

/** Least-squares fit of V = a + b·t − R·I; returns R in ohms, or null if current never varies. */
function fitInternalResistance(slow: SlowFrameSeries): number | null {
  const rows = fitRows(slow);
  if (rows.length < 10) return null;

  const n = rows.length;
  const mt = rows.reduce((s, r) => s + r[0], 0) / n;
  const ma = rows.reduce((s, r) => s + r[1], 0) / n;
  const mv = rows.reduce((s, r) => s + r[2], 0) / n;
  let stt = 0,
    saa = 0,
    sta = 0,
    stv = 0,
    sav = 0;

  for (const [t, a, v] of rows) {
    const dt = t - mt,
      da = a - ma,
      dv = v - mv;
    stt += dt * dt;
    saa += da * da;
    sta += dt * da;
    stv += dt * dv;
    sav += da * dv;
  }

  const det = stt * saa - sta * sta;
  if (!(saa > 0) || !(Math.abs(det) > 1e-12)) return null;

  const coefCurrent = (stt * sav - sta * stv) / det;
  const r = -coefCurrent;

  return r > 0 ? r : null;
}

/** (t, current, voltage) rows where all three are usable. */
function fitRows(slow: SlowFrameSeries): [number, number, number][] {
  const rows: [number, number, number][] = [];

  for (let i = 0; i < slow.vbat.length; i++) {
    const v = slow.vbat[i]!;
    const a = slow.amperage[i]!;
    const t = slow.time[i]!;
    if (Number.isFinite(v) && v > 0 && Number.isFinite(a) && Number.isFinite(t)) rows.push([t, a, v]);
  }

  return rows;
}

/** Mean current over the top 25% of readings. */
function highLoadCurrent(amps: Float32Array): number {
  const xs = Array.from(amps)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const top = xs.slice(Math.floor(xs.length * 0.75));

  return top.length > 0 ? top.reduce((s, x) => s + x, 0) / top.length : 0;
}

function hasValid(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!;
    if (Number.isFinite(v) && v !== 0) return true;
  }

  return false;
}
