import type { StepCurveSet, StepDiagnosticsSummary } from '../types';

/** Window counts added up over every curve and axis; peak setpoint is the largest seen. */
export function sumStepDiagnostics(curves: StepCurveSet[]): StepDiagnosticsSummary {
  const sum = {
    windowsTotal: 0,
    windowsLowExcitation: 0,
    windowsHighExcitation: 0,
    windowsMasked: 0,
    windowsBadSettle: 0,
    windowsAccepted: 0,
    peakSetpoint: 0,
  };

  for (const c of curves) {
    for (const a of c.axes) {
      const d = a.diagnostics;
      sum.windowsTotal += d.windowsTotal;
      sum.windowsLowExcitation += d.windowsLowExcitation;
      sum.windowsHighExcitation += d.windowsHighExcitation;
      sum.windowsMasked += d.windowsMasked;
      sum.windowsBadSettle += d.windowsBadSettle;
      sum.windowsAccepted += d.windowsAccepted;
      sum.peakSetpoint = Math.max(sum.peakSetpoint, d.peakSetpoint);
    }
  }

  return sum;
}
