import type { SetupInfo, TuneItem } from '../types';

/** Firmware, board and loop details; empty header values are left out. */
export function hardwareItems(setup: SetupInfo): TuneItem[] {
  return [
    ['Firmware', `${setup.firmwareKind} ${setup.firmwareVersion}`],
    ['Board', setup.boardInfo || null],
    ['PWM', setup.pwmProtocol || null],
    ['Debug mode', setup.debugMode || null],
    ['Features', setup.features.length > 0 ? setup.features.join(', ') : null],
    ['Loop / sample', `${setup.looptimeUs} µs / ${setup.sampleRateHz.toLocaleString()} Hz`],
  ];
}
