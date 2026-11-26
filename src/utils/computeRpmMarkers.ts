import type { PlotMarker } from '../components/common/TimeSeriesPlot';
import { MOTOR_COLORS } from '../constants';
import type { ParsedLog } from '../types';

/**
 * Build harmonic-frequency markers for each enabled motor. Betaflight logs
 * eRPM as electrical_RPM / 100, so mechanical RPM = eRPM_logged * 100 / polePairs.
 * Prop blade pass freq (1st harmonic of noise) = mech_Hz * blades.
 */
export function computeRpmMarkers(
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
