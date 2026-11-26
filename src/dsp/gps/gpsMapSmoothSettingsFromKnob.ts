import type { GpsMapSmoothSettings } from '../../types';

/**
 * Knob-shaped parameterization in `[0,1]` (internal). Left = nearly raw; right = heavier smooth.
 */
export function gpsMapSmoothSettingsFromKnob(position01: number): GpsMapSmoothSettings {
  const x = Math.max(0, Math.min(1, position01));

  if (x <= 1e-4) {
    return {
      spatialSmooth: false,
      ewmaLambda: 1,
      hannPasses: 0,
      hannHalfWinCap: 0,
      minRunFloor: 5,
      crsChordSteps: 1,
    };
  }

  const spatialSmooth = true;
  /** λ floor was too high (~0.025) — at 100% knob EWMA barely changed stair-step quantization. */
  const rawExpEW = 0.98 * Math.exp(-8 * Math.pow(x, 1.12));
  const ewmaLambda = Math.min(0.55, Math.max(0.0036, rawExpEW));

  const hannPassesFinal = x >= 0.86 ? 2 : x >= 0.32 ? 1 : 0;
  const hannHalfWinCap = hannPassesFinal > 0 ? Math.max(2, Math.round(3 + x * 9)) : 0;

  const minRunFloor = Math.max(4, Math.min(11, Math.round(5 + x * 5)));

  /** Dense Catmull–Rom at high knob ⇒ visually smooth arcs between smoothed knots. */
  const crsChordSteps = Math.min(96, Math.round(2 + Math.pow(x, 0.85) * 78));

  return {
    spatialSmooth,
    ewmaLambda,
    hannPasses: hannPassesFinal,
    hannHalfWinCap,
    minRunFloor,
    crsChordSteps,
  };
}
