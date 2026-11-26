/**
 * Betaflight `debug_mode` name resolution.
 *
 * The bundled blackbox-log parser decodes `debug_mode` against Betaflight 4.4's
 * enum, and hard-errors on any index outside it:
 *
 *   invalid value for header `debug_mode`: `97`
 *
 * 4.4 only goes up to 78 (`FAILSAFE`), so every mode Betaflight has added since
 * — `CHIRP` among them — kills the parse outright. `parser.ts` neutralises the
 * header to `NONE` before handing the buffer to the parser and keeps the raw
 * number; this module turns that number back into a name.
 *
 * Betaflight renumbers this enum between releases — entries get inserted and
 * removed, not just appended — so a name is only meaningful alongside the
 * firmware version that wrote it. Verified against the Betaflight tree:
 *
 *   4.5.1     inserts GPS_CONNECTION at 75, shifting 75+ by one vs 4.4
 *   2025.12.x drops GYRO_SCALED (6), inserts OPTICALFLOW (28), renames
 *             DUAL_* → MULTI_*, D_MIN → D_MAX, and extends to 99
 *   2026.6-rc drops AUTOPILOT_POSITION, moving CHIRP from 97 to 96
 *
 * We therefore only claim a name where we can back it up.
 */

/**
 * `debugModeNames[]` from `src/main/build/debug.c` at tag 2025.12.1 (identical
 * at 2025.12.5). Index is the raw `debug_mode` header value.
 */
const BF_2025_DEBUG_MODES: readonly string[] = [
  'NONE',
  'CYCLETIME',
  'BATTERY',
  'GYRO_FILTERED',
  'ACCELEROMETER',
  'PIDLOOP',
  'RC_INTERPOLATION',
  'ANGLERATE',
  'ESC_SENSOR',
  'SCHEDULER',
  'STACK',
  'ESC_SENSOR_RPM',
  'ESC_SENSOR_TMP',
  'ALTITUDE',
  'FFT',
  'FFT_TIME',
  'FFT_FREQ',
  'RX_FRSKY_SPI',
  'RX_SFHSS_SPI',
  'GYRO_RAW',
  'MULTI_GYRO_RAW',
  'MULTI_GYRO_DIFF',
  'MAX7456_SIGNAL',
  'MAX7456_SPICLOCK',
  'SBUS',
  'FPORT',
  'RANGEFINDER',
  'RANGEFINDER_QUALITY',
  'OPTICALFLOW',
  'LIDAR_TF',
  'ADC_INTERNAL',
  'RUNAWAY_TAKEOFF',
  'SDIO',
  'CURRENT_SENSOR',
  'USB',
  'SMARTAUDIO',
  'RTH',
  'ITERM_RELAX',
  'ACRO_TRAINER',
  'RC_SMOOTHING',
  'RX_SIGNAL_LOSS',
  'RC_SMOOTHING_RATE',
  'ANTI_GRAVITY',
  'DYN_LPF',
  'RX_SPEKTRUM_SPI',
  'DSHOT_RPM_TELEMETRY',
  'RPM_FILTER',
  'D_MAX',
  'AC_CORRECTION',
  'AC_ERROR',
  'MULTI_GYRO_SCALED',
  'DSHOT_RPM_ERRORS',
  'CRSF_LINK_STATISTICS_UPLINK',
  'CRSF_LINK_STATISTICS_PWR',
  'CRSF_LINK_STATISTICS_DOWN',
  'BARO',
  'AUTOPILOT_ALTITUDE',
  'DYN_IDLE',
  'FEEDFORWARD_LIMIT',
  'FEEDFORWARD',
  'BLACKBOX_OUTPUT',
  'GYRO_SAMPLE',
  'RX_TIMING',
  'D_LPF',
  'VTX_TRAMP',
  'GHST',
  'GHST_MSP',
  'SCHEDULER_DETERMINISM',
  'TIMING_ACCURACY',
  'RX_EXPRESSLRS_SPI',
  'RX_EXPRESSLRS_PHASELOCK',
  'RX_STATE_TIME',
  'GPS_RESCUE_VELOCITY',
  'GPS_RESCUE_HEADING',
  'GPS_RESCUE_TRACKING',
  'GPS_CONNECTION',
  'ATTITUDE',
  'VTX_MSP',
  'GPS_DOP',
  'FAILSAFE',
  'GYRO_CALIBRATION',
  'ANGLE_MODE',
  'ANGLE_TARGET',
  'CURRENT_ANGLE',
  'DSHOT_TELEMETRY_COUNTS',
  'RPM_LIMIT',
  'RC_STATS',
  'MAG_CALIB',
  'MAG_TASK_RATE',
  'EZLANDING',
  'TPA',
  'S_TERM',
  'SPA',
  'TASK',
  'GIMBAL',
  'WING_SETPOINT',
  'AUTOPILOT_POSITION',
  'CHIRP',
  'FLASH_TEST_PRBS',
  'MAVLINK_TELEMETRY',
];

/**
 * Highest `debug_mode` the bundled parser accepts. BF 4.4's enum ends at 78
 * (`FAILSAFE`); 79 and up are rejected — confirmed by probing the WASM directly.
 */
export const MAX_PARSER_DEBUG_MODE = 78;

/**
 * Name for a `debug_mode` header value.
 *
 * @param raw - value read from the log header, or null if there was no header
 * @param parserName - what the bundled parser decoded, used for firmware whose
 *   enum it actually knows
 * @param firmwareKind - 'Betaflight' | 'INAV'; the table below is Betaflight's
 * @param firmwareMajor - major from the log's real (pre-patch) version string
 */
export function resolveDebugMode(
  raw: number | null,
  parserName: string,
  firmwareKind: string,
  firmwareMajor: number,
): string {
  // No raw value to work from (header absent, or unparseable) — the parser's
  // own decode is all we have.
  if (raw === null) return parserName;

  // Year-based Betaflight. 2025.12's table is the one we've verified; later
  // releases renumber the tail, so anything past its end stays unnamed.
  if (firmwareKind === 'Betaflight' && firmwareMajor >= 2025) {
    return BF_2025_DEBUG_MODES[raw] ?? `Unknown (${raw})`;
  }

  // 4.x and INAV: the parser decoded the value itself whenever it was in range,
  // so use that. Out of range means we blanked the header, and the parser's
  // "NONE" would be a lie — 4.5 for instance goes up to 89.
  if (raw <= MAX_PARSER_DEBUG_MODE) return parserName;
  return `Unknown (${raw})`;
}
