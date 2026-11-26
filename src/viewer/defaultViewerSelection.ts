import { VIEWER_PRESETS } from '../constants';
import type { ViewerSelection } from '../types';

/** The Tracking preset on all three axes with every motor shown. */
export function defaultViewerSelection(): ViewerSelection {
  return { signals: new Set(VIEWER_PRESETS[0]!.signals), axes: new Set([0, 1, 2]), hiddenMotors: new Set() };
}
