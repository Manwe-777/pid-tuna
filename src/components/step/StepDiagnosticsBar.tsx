import type { StepDiagnosticsSummary } from '../../types';

function Item({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="step-diag__item">
      <span className="step-diag__k">{label}</span>
      <span className="step-diag__v">{value}</span>
    </span>
  );
}

/** How many windows were accepted out of all, and why the rest were dropped. */
export function StepDiagnosticsBar({ diag }: { diag: StepDiagnosticsSummary }) {
  return (
    <div className="step-diag">
      <Item label="accepted" value={diag.windowsAccepted} />
      <span className="step-diag__sep">←</span>
      <Item label="windows" value={diag.windowsTotal} />
      <Item label="too little stick" value={diag.windowsLowExcitation} />
      {diag.windowsHighExcitation > 0 && <Item label="too much stick" value={diag.windowsHighExcitation} />}
      <Item label="low throttle / saturated" value={diag.windowsMasked} />
      <Item label="outliers" value={diag.windowsBadSettle} />
      <Item label="peak setpoint" value={diag.peakSetpoint.toFixed(0)} />
    </div>
  );
}
