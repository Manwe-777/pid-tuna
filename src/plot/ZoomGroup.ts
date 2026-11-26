/** What the group needs from a uPlot instance. */
export interface ZoomMember {
  scales: { x?: { min?: number | null; max?: number | null } };
  setScale(key: 'x', limits: { min: number; max: number }): void;
}

/**
 * Plots that share one X range: zooming one zooms the rest, and a plot that joins
 * takes the current range. A null range means each plot fits its own data.
 */
export class ZoomGroup {
  private readonly members = new Set<ZoomMember>();
  private syncing = false;
  private current: { min: number; max: number } | null = null;

  get range(): { min: number; max: number } | null {
    return this.current;
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
    this.current = isFullRange ? null : { min, max };

    for (const m of this.members) if (m !== from) this.apply(m, { min, max });
  }

  private apply(member: ZoomMember, range: { min: number; max: number }) {
    this.syncing = true;

    try {
      member.setScale('x', range);
    } finally {
      this.syncing = false;
    }
  }
}
