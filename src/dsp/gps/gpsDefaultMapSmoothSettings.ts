import { GPS_MAP_DEFAULT_LIGHT_KNOB } from '../../constants';
import type { GpsMapSmoothSettings } from '../../types';
import { gpsMapSmoothSettingsFromKnob } from './gpsMapSmoothSettingsFromKnob';

/** Map overlay uses this always — no user-facing smoothing control. */
export function gpsDefaultMapSmoothSettings(): GpsMapSmoothSettings {
  return gpsMapSmoothSettingsFromKnob(GPS_MAP_DEFAULT_LIGHT_KNOB);
}
