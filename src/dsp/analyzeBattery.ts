import type { BatteryAnalysis, ParsedLog, SlowFrameSeries } from '../types';
import { median } from '../utils/median';

/**
 * Battery + current analytics. Slow frames in Betaflight tick at a few Hz, so
 * we integrate with the actual frame timestamps (not assumed uniform rate).
 * Cell count follows Betaflight: floor(max voltage / max cell voltage) + 1.
 * Sag comes from the pack's internal resistance R, fitted as
 * V = a + b·t − R·I so the slow discharge over the flight isn't counted as sag.
 */
export function analyzeBattery(log: ParsedLog): BatteryAnalysis {
  const slow = log.slow;
  const hasVoltage = hasValid(slow.vbat);
  const hasCurrent = hasValid(slow.amperage);

  let voltageStart: number | null = null;
  let voltageEnd: number | null = null;
  let voltageMin: number | null = null;
  let voltageMax: number | null = null;
  let cellCount: number | null = null;
  let sagUnderLoadV: number | null = null;
  let perCellMin: number | null = null;
  let perCellEnd: number | null = null;

  if (hasVoltage) {
    const readings: { t: number; v: number }[] = [];
    for (let i = 0; i < slow.vbat.length; i++) {
      const x = slow.vbat[i]!;
      if (Number.isFinite(x) && x > 0) readings.push({ t: slow.time[i] ?? 0, v: x });
    }
    if (readings.length > 0) {
      // Half-second median filter: single-sample glitches would otherwise set the min and max.
      const smooth = medianFilter(
        readings.map((r) => r.v),
        halfSecondWidth(readings),
      );
      const rest = median(readings.filter((r) => r.t - readings[0]!.t <= 1).map((r) => r.v));
      const vMin = Math.min(...smooth);
      voltageStart = readings[0]!.v;
      voltageEnd = smooth[smooth.length - 1]!;
      voltageMin = vMin;
      voltageMax = Math.max(...smooth);
      const c = Math.floor(rest / maxCellVoltage(log)) + 1;
      if (c >= 1 && c <= 12) {
        cellCount = c;
        perCellMin = vMin / c;
        perCellEnd = voltageEnd / c;
      }
    }
  }

  let meanCurrentA: number | null = null;
  let peakCurrentA: number | null = null;
  let rmsCurrentA: number | null = null;
  let mAhUsed: number | null = null;

  if (hasCurrent) {
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
      if (i > 0) {
        const dt = t[i]! - t[i - 1]!;
        if (dt > 0 && dt < 5 /* clamp suspicious gaps */) {
          const ap = a[i - 1]!;
          if (Number.isFinite(ap)) charge += ((ai + ap) / 2) * dt;
        }
      }
    }
    if (n > 0) {
      meanCurrentA = sum / n;
      rmsCurrentA = Math.sqrt(sumSq / n);
      peakCurrentA = peak;
      mAhUsed = charge / 3.6; // A·s → mAh
    }
  }

  let sagAtPeakV: number | null = null;
  const resistance = hasVoltage && hasCurrent ? fitInternalResistance(slow) : null;
  if (resistance != null) {
    sagUnderLoadV = resistance * highLoadCurrent(slow.amperage);
    sagAtPeakV = peakCurrentA != null ? resistance * peakCurrentA : null;
  }

  return {
    hasVoltage,
    hasCurrent,
    cellCount,
    voltageStart,
    voltageEnd,
    voltageMin,
    voltageMax,
    sagUnderLoadV,
    sagAtPeakV,
    internalResistanceMohm: resistance != null ? resistance * 1000 : null,
    perCellMin,
    perCellEnd,
    meanCurrentA,
    peakCurrentA,
    rmsCurrentA,
    mAhUsed,
  };
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
  const rows: [number, number, number][] = [];
  for (let i = 0; i < slow.vbat.length; i++) {
    const v = slow.vbat[i]!;
    const a = slow.amperage[i]!;
    const t = slow.time[i]!;
    if (Number.isFinite(v) && v > 0 && Number.isFinite(a) && Number.isFinite(t)) rows.push([t, a, v]);
  }
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
