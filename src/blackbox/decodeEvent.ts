import { BB_END_OF_LOG, BB_EVENT } from '../constants';
import type { ByteReader } from './ByteReader';

type EventData = Record<string, number | string>;

/** IEEE 754 single read from its 32-bit pattern. */
function floatFromBits(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits);

  return view.getFloat32(0);
}

function inflightAdjustment(r: ByteReader): EventData {
  const head = r.byte();
  const value = head < 128 ? r.signedVB() : floatFromBits(r.u32());

  return { func: head & 0x7f, value, isFloat: head < 128 ? 0 : 1 };
}

const READERS: Record<number, (r: ByteReader) => EventData | null> = {
  [BB_EVENT.syncBeep]: (r) => ({ time: r.unsignedVB() }),
  [BB_EVENT.flightMode]: (r) => ({ newFlags: r.unsignedVB(), lastFlags: r.unsignedVB() }),
  [BB_EVENT.disarm]: (r) => ({ reason: r.unsignedVB() }),
  [BB_EVENT.inflightAdjustment]: inflightAdjustment,
  [BB_EVENT.loggingResume]: (r) => ({ logIteration: r.unsignedVB(), currentTime: r.unsignedVB() }),
  [BB_EVENT.autotuneCycleStart]: (r) => {
    const phase = r.byte();
    const cycle = r.byte();

    return { phase, cycle: cycle & 0x7f, rising: (cycle >> 7) & 1, p: r.byte(), i: r.byte(), d: r.byte() };
  },
  [BB_EVENT.autotuneCycleResult]: (r) => ({ overshot: r.byte(), p: r.byte(), i: r.byte(), d: r.byte() }),
  [BB_EVENT.autotuneTargets]: (r) => ({
    currentAngle: r.s16() / 10,
    targetAngle: r.s8(),
    targetAngleAtPeak: r.s8(),
    firstPeakAngle: r.s16() / 10,
    secondPeakAngle: r.s16() / 10,
  }),
  [BB_EVENT.gtuneCycleResult]: (r) => ({ axis: r.byte(), gyroAvg: r.signedVB(), newP: r.s16() }),
  [BB_EVENT.twitchTest]: (r) => ({ stage: r.byte(), value: floatFromBits(r.u32()) }),
  [BB_EVENT.logEnd]: (r) => {
    if (r.text(BB_END_OF_LOG.length) !== BB_END_OF_LOG) return null;
    // The log stops here; anything after belongs to nothing.
    r.end = r.pos;

    return {};
  },
};

/** Reads an event frame after its `E`: its type and data, or null for an unknown or false event. */
export function decodeEvent(r: ByteReader): { type: number; data: EventData } | null {
  const type = r.byte();
  const read = READERS[type];
  if (!read) return null;
  const data = read(r);

  return data ? { type, data } : null;
}
