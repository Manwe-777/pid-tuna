import type { ParsedLog } from './types';

export type SlotState =
  | { kind: 'parsing'; fileName: string; progress: number; rows: number }
  | { kind: 'ready'; log: ParsedLog }
  | { kind: 'error'; fileName: string; message: string };

export interface LogSlot {
  id: string;
  state: SlotState;
  enabled: boolean;
  /** Index into DASH_PATTERNS — picks the line style. Solid for the first log. */
  dashIndex: number;
}

/** Line-dash sequences used to differentiate logs on the same plot. */
export const DASH_PATTERNS: ReadonlyArray<readonly number[]> = [
  [], // 0: solid
  [6, 4], // 1: dashed
  [2, 3], // 2: dotted
  [10, 4, 3, 4], // 3: dash-dot
  [1, 2], // 4: tight dots
  [8, 3, 2, 3, 2, 3], // 5: dash-dot-dot
];

/** Distinct colors assigned per log in multi-log mode. */
export const LOG_COLORS: readonly string[] = [
  '#ff5d8f', // pink
  '#5fa8ff', // sky blue
  '#5dff5d', // bright green
  '#fff75d', // yellow
  '#bd5dff', // purple
  '#ff9b5d', // orange
];

export function dashFor(slot: LogSlot): number[] {
  const pattern = DASH_PATTERNS[slot.dashIndex] ?? DASH_PATTERNS[0]!;
  return [...pattern];
}

export function colorFor(slot: LogSlot): string {
  return LOG_COLORS[slot.dashIndex % LOG_COLORS.length]!;
}

let _slotCounter = 0;
export function newSlotId(): string {
  _slotCounter = (_slotCounter + 1) % 1_000_000;
  return `s${Date.now().toString(36)}-${_slotCounter}`;
}

/** Loaded logs that are toggled on for plotting. */
export function enabledLogs(slots: LogSlot[]): Array<{ slot: LogSlot; log: ParsedLog }> {
  const out: Array<{ slot: LogSlot; log: ParsedLog }> = [];
  for (const s of slots) {
    if (!s.enabled) continue;
    if (s.state.kind !== 'ready') continue;
    out.push({ slot: s, log: s.state.log });
  }
  return out;
}

/** A windowed log paired with its slot for rendering attribution. */
export interface LogEntry {
  slot: LogSlot;
  /** Already sliced to the active time window. */
  log: ParsedLog;
  dash: number[];
}

export function shortName(slot: LogSlot): string {
  if (slot.state.kind !== 'ready') return slot.id.slice(0, 6);
  return slot.state.log.fileName.replace(/\.(bbl|bfl|csv)$/i, '');
}
