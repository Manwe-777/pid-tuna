import { DOMINANT_THRESHOLD_PCT } from '../../constants';
import type { AxisImbalance, AxisKind, MotorStats } from '../../types';
import { detectSingleOutlier } from './detectSingleOutlier';

/**
 * Project per-motor means onto the three rigid-body axes (pitch / roll / yaw).
 * The sign conventions follow the default Quad-X mixer; the user knows their
 * own motor mapping and can interpret directionality on their end.
 *
 * For non-4-motor frames we skip axis projection and only attempt single-motor
 * outlier detection.
 */
export function analyzeImbalance(
  motors: MotorStats[],
  yawReversed = false,
): {
  axes: AxisImbalance[];
  dominantAxis: AxisKind | null;
  singleMotorOutlier: { motorIndex: number; deltaPct: number } | null;
} {
  if (motors.length !== 4) {
    return {
      axes: [],
      dominantAxis: null,
      singleMotorOutlier: detectSingleOutlier(motors),
    };
  }

  const m1 = motors[0]!.pwmMean;
  const m2 = motors[1]!.pwmMean;
  const m3 = motors[2]!.pwmMean;
  const m4 = motors[3]!.pwmMean;
  const overall = (m1 + m2 + m3 + m4) / 4;

  if (overall <= 0) {
    return { axes: [], dominantAxis: null, singleMotorOutlier: null };
  }

  const pct = (delta: number) => (delta / overall) * 100;

  const axes: AxisImbalance[] = [
    { axis: 'pitch', deltaPct: pct(m1 + m3 - (m2 + m4)) / 2 },
    { axis: 'roll', deltaPct: pct(m1 + m2 - (m3 + m4)) / 2 },
    { axis: 'yaw', deltaPct: ((yawReversed ? -1 : 1) * pct(m2 + m3 - (m1 + m4))) / 2 },
  ];

  let dominantAxis: AxisKind | null = null;
  let best = DOMINANT_THRESHOLD_PCT;

  for (const a of axes) {
    if (Math.abs(a.deltaPct) > best) {
      best = Math.abs(a.deltaPct);
      dominantAxis = a.axis;
    }
  }

  return { axes, dominantAxis, singleMotorOutlier: detectSingleOutlier(motors) };
}
