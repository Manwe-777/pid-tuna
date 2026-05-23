import type { ParsedLog, SlowFrameSeries } from '../types';

export interface BatteryAnalysis {
  hasVoltage: boolean;
  hasCurrent: boolean;
  /** Estimated battery cell count (rounded). */
  cellCount: number | null;
  /** First non-noise reading — proxy for "at rest" voltage when armed. */
  voltageStart: number | null;
  /** Final reading — voltage at end of log. */
  voltageEnd: number | null;
  /** Minimum voltage seen across the whole window (deepest sag). */
  voltageMin: number | null;
  /** Maximum voltage seen (typically at-rest peak). */
  voltageMax: number | null;
  /** Mean voltage drop from no-load baseline when current is "high". */
  sagUnderLoadV: number | null;
  /** Per-cell min voltage if cell count known. */
  perCellMin: number | null;
  /** Per-cell end voltage if cell count known. */
  perCellEnd: number | null;
  /** Mean current draw in Amps. */
  meanCurrentA: number | null;
  /** Peak current draw in Amps. */
  peakCurrentA: number | null;
  /** Total charge consumed in mAh (integration of current over time). */
  mAhUsed: number | null;
  /** RMS current draw — proxy for energy demand. */
  rmsCurrentA: number | null;
}

/**
 * Battery + current analytics. Slow frames in Betaflight tick at a few Hz, so
 * we integrate with the actual frame timestamps (not assumed uniform rate).
 * "Under load" sag is the mean drop from a baseline voltage (top 5% of readings)
 * measured during high-current intervals (top 25% of current readings).
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
    const v = slow.vbat;
    let vMin = Infinity;
    let vMax = -Infinity;
    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < v.length; i++) {
      const x = v[i]!;
      if (!Number.isFinite(x) || x <= 0) continue;
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
      if (x < vMin) vMin = x;
      if (x > vMax) vMax = x;
    }
    if (firstIdx >= 0) {
      voltageStart = v[firstIdx]!;
      voltageEnd = v[lastIdx]!;
      voltageMin = vMin;
      voltageMax = vMax;
      // Cell count: most LiPos are 4.2 V/cell fully charged, Li-ion ~4.1.
      // Round vMax / 4.15 to nearest integer; clamp to plausible 1..12.
      const c = Math.round(vMax / 4.15);
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
        const dt = (t[i]! - t[i - 1]!);
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
      mAhUsed = (charge / 3.6); // A·s → mAh
    }
  }

  // Sag under load: mean voltage drop when current is in top 25% of readings.
  if (hasVoltage && hasCurrent) {
    sagUnderLoadV = computeSagUnderLoad(slow, voltageMax!);
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
    perCellMin,
    perCellEnd,
    meanCurrentA,
    peakCurrentA,
    rmsCurrentA,
    mAhUsed,
  };
}

function computeSagUnderLoad(slow: SlowFrameSeries, vMax: number): number | null {
  const amps: number[] = [];
  for (let i = 0; i < slow.amperage.length; i++) {
    const a = slow.amperage[i]!;
    if (Number.isFinite(a)) amps.push(a);
  }
  if (amps.length === 0) return null;
  amps.sort((x, y) => x - y);
  const q3 = amps[Math.floor(amps.length * 0.75)]!;

  let sum = 0;
  let n = 0;
  for (let i = 0; i < slow.amperage.length; i++) {
    const a = slow.amperage[i]!;
    const v = slow.vbat[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(v) || v <= 0) continue;
    if (a < q3) continue;
    sum += (vMax - v);
    n++;
  }
  return n > 0 ? sum / n : null;
}

function hasValid(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!;
    if (Number.isFinite(v) && v !== 0) return true;
  }
  return false;
}
