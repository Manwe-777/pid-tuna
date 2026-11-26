import type { StepDiagnostics } from '../../types';

export function emptyStepDiagnostics(): StepDiagnostics {
  return {
    windowsTotal: 0,
    windowsLowExcitation: 0,
    windowsHighExcitation: 0,
    windowsMasked: 0,
    windowsBadSettle: 0,
    windowsAccepted: 0,
    peakSetpoint: 0,
  };
}
