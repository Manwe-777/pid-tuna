import type { BatteryAnalysis, ScoreEntry, ScoreStatus } from '../../types';

export function batteryEntry(battery: BatteryAnalysis): ScoreEntry | null {
  if (!battery.hasVoltage) return null;
  let status: ScoreStatus = 'na';
  let value = '—';
  if (battery.perCellMin != null) {
    status = battery.perCellMin >= 3.5 ? 'good' : battery.perCellMin >= 3.3 ? 'warn' : 'bad';
    value = `${battery.perCellMin.toFixed(2)} V/cell min`;
  } else if (battery.voltageMin != null) {
    value = `${battery.voltageMin.toFixed(2)} V min`;
    status = 'na';
  }
  return {
    key: 'Battery sag',
    status,
    value,
    detail:
      battery.sagUnderLoadV != null
        ? `Sag under load ${battery.sagUnderLoadV.toFixed(2)} V (${battery.internalResistanceMohm!.toFixed(0)} mΩ)` +
          (battery.mAhUsed != null ? ` · ${battery.mAhUsed.toFixed(0)} mAh used` : '')
        : undefined,
  };
}
