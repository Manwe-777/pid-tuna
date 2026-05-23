export const AXIS_NAMES = ['Roll', 'Pitch', 'Yaw'] as const;
export const AXIS_COLORS = ['#ff5d5d', '#4ee08a', '#5fa8ff'] as const;
export type AxisName = (typeof AXIS_NAMES)[number];
