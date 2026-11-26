import { AXIS_COLORS, AXIS_NAMES, MOTOR_COLORS, VIEWER_LANE_HEIGHTS, VIEWER_SIGNALS } from '../constants';
import { colorFor } from '../logs/colorFor';
import { shortName } from '../logs/shortName';
import type {
  LogEntry,
  ParsedLog,
  PlotSeries,
  ViewerLane,
  ViewerSelection,
  ViewerSignalDef,
  ViewerSignalKey,
} from '../types';
import { extractSignal } from '../utils/extractSignal';
import { padWithGap } from '../utils/padWithGap';
import { viewerSignalAvailable } from './viewerSignalAvailable';

const MOTOR_LANES: ReadonlyArray<{
  kind: 'motors' | 'eRpm';
  title: string;
  channels: (log: ParsedLog) => readonly Float32Array[];
}> = [
  { kind: 'motors', title: 'Motors', channels: (log) => log.motor },
  { kind: 'eRpm', title: 'eRPM', channels: (log) => log.eRpm },
];

/**
 * One line. When it is alone in its lane with several logs, it takes the log's colour and
 * name; otherwise its own colour, with the log's dash and name prefix when there are several logs.
 */
function line(
  entry: LogEntry,
  entries: readonly LogEntry[],
  values: Float32Array,
  own: { color: string; label: string; width: number },
  byLog: boolean,
): PlotSeries {
  const length = entries[0]!.log.time.length;
  const base = { values: padWithGap(values, length), width: own.width };
  if (byLog) return { ...base, label: shortName(entry.slot), stroke: colorFor(entry.slot) };
  if (entries.length === 1) return { ...base, label: own.label, stroke: own.color };
  const dash = entry.dash.length ? entry.dash : undefined;

  return { ...base, label: `${shortName(entry.slot)} ${own.label}`, stroke: own.color, dash };
}

function hasData(entry: LogEntry, def: ViewerSignalDef) {
  return !def.needs || entry.log.presence[def.needs];
}

function axisValues(entry: LogEntry, key: ViewerSignalKey, axis: number) {
  if (key === 'throttle' || key === 'motors' || key === 'eRpm') return null;

  return extractSignal(entry.log, key, axis);
}

function axisLane(entries: readonly LogEntry[], defs: readonly ViewerSignalDef[], axis: number): ViewerLane {
  const byLog = entries.length > 1 && defs.length === 1;
  const series: PlotSeries[] = [];

  for (const def of defs) {
    const own = { color: def.color || AXIS_COLORS[axis]!, label: def.label, width: def.width };

    for (const entry of entries) {
      const values = hasData(entry, def) ? axisValues(entry, def.key, axis) : null;
      if (values?.length) series.push(line(entry, entries, values, own, byLog));
    }
  }

  return {
    id: `axis${axis}`,
    title: AXIS_NAMES[axis]!,
    dot: AXIS_COLORS[axis],
    yLabel: [...new Set(defs.map((d) => d.unit))].join(' · '),
    height: VIEWER_LANE_HEIGHTS.axis,
    series,
  };
}

function throttleLane(entries: readonly LogEntry[], def: ViewerSignalDef): ViewerLane {
  const own = { color: def.color, label: def.label, width: def.width };
  const series = entries.map((e) => line(e, entries, e.log.rcCommand[3]!, own, entries.length > 1));

  return { id: 'throttle', title: 'Throttle', yLabel: def.unit, height: VIEWER_LANE_HEIGHTS.throttle, series };
}

function motorLane(
  entries: readonly LogEntry[],
  def: ViewerSignalDef,
  lane: (typeof MOTOR_LANES)[number],
  hidden: ReadonlySet<number>,
): ViewerLane {
  const count = Math.max(...entries.map((e) => lane.channels(e.log).length));
  const shown = Array.from({ length: count }, (_, i) => i).filter((i) => !hidden.has(i));
  const byLog = entries.length > 1 && shown.length === 1;
  const series: PlotSeries[] = [];

  for (const motor of shown) {
    const own = { color: MOTOR_COLORS[motor % MOTOR_COLORS.length]!, label: `M${motor + 1}`, width: def.width };

    for (const entry of entries) {
      const values = hasData(entry, def) ? lane.channels(entry.log)[motor] : undefined;
      if (values?.length) series.push(line(entry, entries, values, own, byLog));
    }
  }

  const title = shown.length === 1 && count > 1 ? `${lane.title} — M${shown[0]! + 1}` : lane.title;

  return { id: lane.kind, title, yLabel: def.unit, height: VIEWER_LANE_HEIGHTS[lane.kind], series };
}

/**
 * The viewer's stacked plots for a selection: one lane per chosen axis holding every chosen
 * per-axis signal, then throttle, motor and eRPM lanes. Signals no log has are left out.
 */
export function viewerLanes(entries: readonly LogEntry[], selection: ViewerSelection): ViewerLane[] {
  const defs = VIEWER_SIGNALS.filter((d) => selection.signals.has(d.key) && viewerSignalAvailable(d, entries));
  const axisDefs = defs.filter((d) => d.lane === 'axis');
  const lanes: ViewerLane[] = [];

  if (axisDefs.length > 0) {
    for (const axis of [0, 1, 2]) if (selection.axes.has(axis)) lanes.push(axisLane(entries, axisDefs, axis));
  }

  const throttle = defs.find((d) => d.lane === 'throttle');
  if (throttle) lanes.push(throttleLane(entries, throttle));

  for (const lane of MOTOR_LANES) {
    const def = defs.find((d) => d.lane === lane.kind);
    if (def) lanes.push(motorLane(entries, def, lane, selection.hiddenMotors));
  }

  return lanes;
}
