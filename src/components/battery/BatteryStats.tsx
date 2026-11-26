import type { BatteryAnalysis } from '../../dsp/battery';
import { fmtA } from '../../utils/fmtA';
import { fmtV } from '../../utils/fmtV';

export function BatteryStats({ analysis }: { analysis: BatteryAnalysis }) {
  const rows: Array<{ label: string; value: string; cls?: string }> = [];
  if (analysis.hasVoltage) {
    rows.push({ label: 'V start', value: fmtV(analysis.voltageStart) });
    rows.push({ label: 'V end', value: fmtV(analysis.voltageEnd) });
    rows.push({ label: 'V min', value: fmtV(analysis.voltageMin) });
    if (analysis.perCellMin != null) {
      const cls =
        analysis.perCellMin < 3.3 ? 'diff-tok--down' : analysis.perCellMin < 3.5 ? 'diff-tok--changed' : 'diff-tok--up';
      rows.push({ label: 'V/cell min', value: `${analysis.perCellMin.toFixed(2)} V`, cls });
    }
    if (analysis.sagUnderLoadV != null) {
      rows.push({ label: 'Sag under load', value: `${analysis.sagUnderLoadV.toFixed(2)} V` });
      if (analysis.sagAtPeakV != null)
        rows.push({ label: 'Sag at peak current', value: `${analysis.sagAtPeakV.toFixed(2)} V` });
      if (analysis.internalResistanceMohm != null) {
        rows.push({ label: 'Internal resistance', value: `${analysis.internalResistanceMohm.toFixed(0)} mΩ` });
      }
    }
  }
  if (analysis.hasCurrent) {
    rows.push({ label: 'Mean A', value: fmtA(analysis.meanCurrentA) });
    rows.push({ label: 'Peak A', value: fmtA(analysis.peakCurrentA) });
    if (analysis.mAhUsed != null) {
      rows.push({ label: 'Used', value: `${analysis.mAhUsed.toFixed(0)} mAh` });
    }
  }
  return (
    <div className="battery-stats">
      {rows.map((r) => (
        <div key={r.label} className="battery-stat">
          <span className="battery-stat__label">{r.label}</span>
          <span className={`battery-stat__value${r.cls ? ` ${r.cls}` : ''}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
