import type { TimeSpan } from '../types';

function sameSpan(a: TimeSpan | null, b: TimeSpan | null): boolean {
  return a?.min === b?.min && a?.max === b?.max;
}

/** What the group needs from a uPlot instance. */
export interface ZoomMember {
  scales: { x?: { min?: number | null; max?: number | null } };
  setScale(key: 'x', limits: { min: number; max: number }): void;
}

/**
 * Plots that share one X range and one pending selection. Zooming one zooms the rest,
 * and a plot that joins takes the current range. A null range means each plot fits its own data.
 */
export class ZoomGroup {
  private readonly members = new Set<ZoomMember>();
  private readonly listeners = new Set<() => void>();
  private syncing = false;
  private current: TimeSpan | null = null;
  private pending: TimeSpan | null = null;

  get range(): TimeSpan | null {
    return this.current;
  }

  /** The span picked by dragging, waiting for a double-click to zoom into it. */
  get selection(): TimeSpan | null {
    return this.pending;
  }

  join(member: ZoomMember): () => void {
    this.members.add(member);
    if (this.current) this.apply(member, this.current);

    return () => this.members.delete(member);
  }

  /** Call from a member's X `setScale` hook; spreads its range to the others. */
  publish(from: ZoomMember, isFullRange: boolean): void {
    if (this.syncing) return;
    const { min, max } = from.scales.x ?? {};
    if (min == null || max == null) return;
    const next = isFullRange ? null : { min, max };
    const changed = !sameSpan(next, this.current);
    this.current = next;

    for (const m of this.members) if (m !== from) this.apply(m, { min, max });
    if (changed) this.notify();
  }

  /** Sets or clears the selection; an empty span clears it. */
  select(span: TimeSpan | null): void {
    const next = span && span.max > span.min ? span : null;
    if (sameSpan(next, this.pending)) return;
    this.pending = next;
    this.notify();
  }

  /** Zooms every plot to the selection and clears it. False when nothing was selected. */
  zoomToSelection(from: ZoomMember): boolean {
    const span = this.pending;
    if (!span) return false;
    this.select(null);
    from.setScale('x', span);

    return true;
  }

  /** For `useSyncExternalStore`: called whenever the selection or the zoom changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  private notify() {
    for (const l of this.listeners) l();
  }

  private apply(member: ZoomMember, range: TimeSpan) {
    this.syncing = true;

    try {
      member.setScale('x', range);
    } finally {
      this.syncing = false;
    }
  }
}
