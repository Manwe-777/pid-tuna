import type { BfFilterKind } from './bfFilterSections';

export interface FilterPart {
  kind: BfFilterKind;
  hz: number;
  q?: number;
  /** Blend with the unfiltered signal, 0–1: y = (1 − w)·x + w·H(x). Default 1. */
  weight?: number;
  /** How many identical copies run in series (RPM notches: one per motor). Default 1. */
  copies?: number;
}
