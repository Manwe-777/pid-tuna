/**
 * Where unfiltered gyro in deg/s comes from: the `gyroUnfilt` field when it
 * was logged, else `debug[0..2]` only in GYRO_SCALED mode. Other debug modes
 * are not gyro, and GYRO_RAW is raw sensor counts in the sensor's own axes.
 */
export function rawGyroSource(hasUnfiltField: boolean, hasDebugField: boolean, debugMode: string): 'gyroUnfilt' | 'debug' | null {
  if (hasUnfiltField) return 'gyroUnfilt';
  if (hasDebugField && debugMode.replace(/[^a-z]/gi, '').toUpperCase() === 'GYROSCALED') return 'debug';

  return null;
}
