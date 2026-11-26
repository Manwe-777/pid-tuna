import type { ViewerSelection } from '../types';

export function serializeViewerSelection(s: ViewerSelection): string {
  return JSON.stringify({ signals: [...s.signals], axes: [...s.axes], hiddenMotors: [...s.hiddenMotors] });
}
