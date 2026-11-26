import type { LogSlot, ParsedLog } from '../types';
import { enabledLogs } from './enabledLogs';

/**
 * The loaded logs, in sidebar order. Methods change this instance; React
 * state holds a clone per change (see `useLogLibrary`).
 */
export class LogLibrary {
  constructor(private items: LogSlot[] = []) {}

  get slots(): readonly LogSlot[] {
    return this.items;
  }

  /** Ready logs that are toggled on, for plotting. */
  get enabled(): Array<{ slot: LogSlot; log: ParsedLog }> {
    return enabledLogs(this.items);
  }

  clone(): LogLibrary {
    return new LogLibrary([...this.items]);
  }

  /** Adds a log that is still parsing. Its line style follows the number of logs already loaded. */
  add(id: string, fileName: string): void {
    this.items.push({
      id,
      enabled: true,
      dashIndex: this.items.length,
      state: { kind: 'parsing', fileName, progress: 0, rows: 0 },
    });
  }

  setProgress(id: string, fileName: string, progress: number, rows: number): void {
    this.patch(id, () => ({ state: { kind: 'parsing', fileName, progress, rows } }));
  }

  setReady(id: string, log: ParsedLog): void {
    this.patch(id, () => ({ state: { kind: 'ready', log } }));
  }

  setError(id: string, fileName: string, message: string): void {
    this.patch(id, () => ({ state: { kind: 'error', fileName, message } }));
  }

  toggle(id: string): void {
    this.patch(id, (s) => ({ enabled: !s.enabled }));
  }

  remove(id: string): void {
    this.items = this.items.filter((s) => s.id !== id);
  }

  /** Moves one log to another's position; unknown ids leave the order as it is. */
  reorder(fromId: string, toId: string): void {
    const from = this.items.findIndex((s) => s.id === fromId);
    const to = this.items.findIndex((s) => s.id === toId);
    if (fromId === toId || from < 0 || to < 0) return;

    const [moved] = this.items.splice(from, 1);
    this.items.splice(to, 0, moved!);
  }

  private patch(id: string, change: (slot: LogSlot) => Partial<LogSlot>): void {
    this.items = this.items.map((s) => (s.id === id ? { ...s, ...change(s) } : s));
  }
}
