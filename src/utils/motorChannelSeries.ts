import { MOTOR_COLORS } from '../constants';
import { colorFor } from '../logs/colorFor';
import { shortName } from '../logs/shortName';
import type { LogEntry, ParsedLog, PlotSeries } from '../types';
import { align } from './align';

/**
 * Per-motor channels (output or eRPM) as plot series: with several logs, the
 * selected motor once per log in log colours; with one log, every motor.
 */
export function motorChannelSeries(
  entries: LogEntry[],
  channels: (log: ParsedLog) => Float32Array[],
  selectedMotor: number,
  options: { length: number; skipEmpty: boolean },
): PlotSeries[] {
  if (entries.length === 1) {
    return channels(entries[0]!.log).map((sig, idx) => ({
      label: `Motor ${idx + 1}`,
      values: sig,
      stroke: MOTOR_COLORS[idx % MOTOR_COLORS.length]!,
      width: 1,
    }));
  }

  return entries.flatMap((e) => {
    const sig = channels(e.log)[selectedMotor];
    if (!sig || (options.skipEmpty && sig.length === 0)) return [];

    return [{ label: shortName(e.slot), values: align(sig, options.length), stroke: colorFor(e.slot), width: 1 }];
  });
}
