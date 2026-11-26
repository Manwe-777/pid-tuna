import { BB_EVENT, BB_MAX_FRAME_BYTES, BB_MAX_ITERATION_JUMP, BB_MAX_TIME_JUMP_US, BB_PREDICTOR } from '../constants';
import type { BbEvent, BbFrameDef, BbHeader } from '../types';
import type { PredictionContext } from './applyPrediction';
import { ByteReader } from './ByteReader';
import { decodeEvent } from './decodeEvent';
import { decodeFields } from './decodeFields';

/** Receives decoded frames. Frame arrays are reused: copy what you keep before returning. */
export interface BbHandlers {
  /** A main (I or P) frame; values follow the I frame's field names. */
  main?: (values: readonly number[]) => void;
  slow?: (values: readonly number[]) => void;
  gps?: (values: readonly number[]) => void;
  event?: (event: BbEvent) => void;
  /** Share of the log read so far, 0 to 1. */
  progress?: (share: number) => void;
}

type Marker = 'I' | 'P' | 'S' | 'G' | 'H' | 'E';

const MARKERS: Record<number, Marker> = { 0x49: 'I', 0x50: 'P', 0x53: 'S', 0x47: 'G', 0x48: 'H', 0x45: 'E' };

const ITERATION = 0;

const TIME = 1;

/** Frames between progress reports. */
const PROGRESS_EVERY = 4096;

/** Values as their field types read them: unsigned fields back from 32-bit two's complement. */
function publish(raw: number[], out: number[], def: BbFrameDef): number[] {
  const n = def.names.length;
  out.length = n;
  for (let i = 0; i < n; i++) out[i] = def.signed[i] ? raw[i]! : raw[i]! >>> 0;

  return out;
}

/**
 * Decodes the data frames of one blackbox log. Main frames are predicted from the previous
 * two; a frame that doesn't end where the next one starts, or whose time or iteration jumps
 * implausibly, breaks the chain until the next I frame.
 */
export class BlackboxDecoder {
  private readonly r: ByteReader;
  private readonly main: BbFrameDef;
  private ring: number[][];
  private previous: number[] | null = null;
  private previous2: number[] | null = null;
  private mainValid = false;
  private lastIteration = -1;
  private lastTime = -1;
  private readonly slow: number[] = [];
  private readonly gps: number[] = [];
  private readonly homeFrame: number[] = [];
  private home: [number, number] | null = null;
  private pendingEvent: BbEvent | null = null;
  private readonly out: number[] = [];
  private frames = 0;
  private readonly motor0: number;

  constructor(
    data: Uint8Array,
    private readonly header: BbHeader,
    end: number,
  ) {
    const main = header.frameDefs.I;
    const p = header.frameDefs.P;

    if (!main?.names.length || main.encodings.length !== main.names.length) {
      throw new Error('Log is missing its I frame definitions; the header may be corrupt');
    }

    if (!p || p.encodings.length !== main.names.length || p.predictors.length !== main.names.length) {
      throw new Error('Log is missing its P frame definitions; the header may be corrupt');
    }

    this.main = main;
    this.motor0 = main.names.indexOf('motor[0]');
    this.r = new ByteReader(data, header.dataStart, end);
    this.ring = [[], [], []];
    this.pairHomeCoordinates();
  }

  /** Decodes every frame, calling the handlers as they complete. */
  run(handlers: BbHandlers): void {
    const r = this.r;
    let last: Marker | null = null;
    let frameStart = 0;
    let prematureEof = false;

    for (;;) {
      const c = r.byte();

      if (last) {
        const looksComplete = MARKERS[c] !== undefined || (!prematureEof && c < 0);

        if (r.pos - frameStart > BB_MAX_FRAME_BYTES || !looksComplete) {
          // Corrupt: resynchronise from the byte after the bad frame's marker.
          this.invalidate();
          r.pos = frameStart + 1;
          r.eof = false;
          last = null;
          prematureEof = false;
          continue;
        }

        this.complete(last, handlers);
      }

      if (c < 0) break;
      frameStart = r.pos - 1;
      last = this.parse(MARKERS[c]);
      prematureEof = r.eof;
    }

    handlers.progress?.(1);
  }

  /** Starts a frame; returns its marker when it can be decoded. */
  private parse(marker: Marker | undefined): Marker | null {
    const defs = this.header.frameDefs;

    if (!marker || (marker !== 'E' && !defs[marker])) {
      this.mainValid = false;

      return null;
    }

    if (marker === 'I') this.decodeMain(defs.I!, this.previous, null, 0);
    else if (marker === 'P') this.decodeMain(defs.P!, this.previous, this.previous2, this.skippedSinceLast());
    else if (marker === 'E') this.pendingEvent = this.readEvent();
    else this.decodeSide(marker, defs[marker]!);

    return marker;
  }

  private decodeMain(def: BbFrameDef, previous: number[] | null, previous2: number[] | null, skipped: number) {
    // Without a valid chain a P frame has nothing to predict from, but is still read to stay aligned.
    decodeFields(this.r, def, this.context(this.ring[0]!, previous, previous2), skipped, this.header.dataVersion);
  }

  private decodeSide(marker: 'S' | 'G' | 'H', def: BbFrameDef) {
    const target = marker === 'S' ? this.slow : marker === 'G' ? this.gps : this.homeFrame;
    decodeFields(this.r, def, this.context(target, null, null), 0, this.header.dataVersion);
  }

  private readEvent(): BbEvent | null {
    const e = decodeEvent(this.r);

    return e ? { ...e, time: Math.max(0, this.lastTime) } : null;
  }

  private context(current: number[], previous: number[] | null, previous2: number[] | null): PredictionContext {
    return {
      current,
      previous,
      previous2,
      minThrottle: this.header.minThrottle,
      minMotor: this.header.minMotor,
      vbatRef: this.header.vbatRef,
      motor0: this.motor0,
      home: this.home,
      lastMainTime: this.previous ? this.previous[TIME]! : null,
    };
  }

  /** Finishes a frame once the next one is seen to start where it ended. */
  private complete(marker: Marker, handlers: BbHandlers) {
    if (marker === 'I') this.completeIntra(handlers);
    else if (marker === 'P') this.completeInter(handlers);
    else if (marker === 'S') handlers.slow?.(publish(this.slow, this.out, this.header.frameDefs.S!));
    else if (marker === 'H') this.home = this.homeCoordinates();
    else if (marker === 'G' && this.home) handlers.gps?.(publish(this.gps, this.out, this.header.frameDefs.G!));
    else if (marker === 'E') this.completeEvent(handlers);
  }

  private completeIntra(handlers: BbHandlers) {
    const cur = this.ring[0]!;
    const plausible =
      this.lastIteration < 0 ||
      (cur[ITERATION]! >= this.lastIteration &&
        cur[ITERATION]! < this.lastIteration + BB_MAX_ITERATION_JUMP &&
        cur[TIME]! >= this.lastTime &&
        cur[TIME]! < this.lastTime + BB_MAX_TIME_JUMP_US);

    if (!plausible) {
      this.invalidate();

      return;
    }

    this.accept(cur, handlers);
    // An I frame is the only history a P frame after it can use.
    this.previous2 = cur;
    this.rotate();
  }

  private completeInter(handlers: BbHandlers) {
    const cur = this.ring[0]!;
    const jumped =
      cur[TIME]! > this.lastTime + BB_MAX_TIME_JUMP_US || cur[ITERATION]! > this.lastIteration + BB_MAX_ITERATION_JUMP;

    if (!this.mainValid || jumped) {
      this.mainValid = false;

      return;
    }

    this.accept(cur, handlers);
    this.previous2 = this.previous;
    this.rotate();
  }

  private accept(cur: number[], handlers: BbHandlers) {
    this.mainValid = true;
    this.lastIteration = cur[ITERATION]!;
    this.lastTime = cur[TIME]!;
    handlers.main?.(publish(cur, this.out, this.main));
    if (++this.frames % PROGRESS_EVERY === 0) handlers.progress?.(this.share());
  }

  private completeEvent(handlers: BbHandlers) {
    const e = this.pendingEvent;
    if (!e) return;

    if (e.type === BB_EVENT.loggingResume) {
      // Logging paused and resumed: accept the jump in iteration and time.
      this.lastIteration = Number(e.data.logIteration);
      this.lastTime = Number(e.data.currentTime);
    }

    handlers.event?.(e);
  }

  /** Makes the frame just decoded the previous one and decodes the next into a free buffer. */
  private rotate() {
    const [cur, a, b] = this.ring as [number[], number[], number[]];
    this.previous = cur;
    this.ring = this.previous2 === a ? [b, cur, a] : [a, cur, b];
  }

  private invalidate() {
    this.mainValid = false;
    this.previous = null;
    this.previous2 = null;
  }

  private skippedSinceLast(): number {
    if (this.lastIteration < 0) return 0;
    const { iInterval, pNum, pDenom } = this.header;
    let count = 0;

    for (let i = this.lastIteration + 1; ((i % iInterval) + pNum - 1) % pDenom >= pNum; i++) count++;

    return count;
  }

  /** The two home-coordinate fields of G frames share a predictor id; tell the second apart. */
  private pairHomeCoordinates() {
    const g = this.header.frameDefs.G;
    if (!g) return;

    for (let i = 1; i < g.predictors.length; i++) {
      if (g.predictors[i - 1] === BB_PREDICTOR.homeCoord && g.predictors[i] === BB_PREDICTOR.homeCoord) {
        g.predictors[i] = BB_PREDICTOR.homeCoord1;
      }
    }
  }

  private homeCoordinates(): [number, number] | null {
    const names = this.header.frameDefs.H?.names ?? [];
    const lat = names.indexOf('GPS_home[0]');
    const lon = names.indexOf('GPS_home[1]');

    return lat >= 0 && lon >= 0 ? [this.homeFrame[lat]!, this.homeFrame[lon]!] : null;
  }

  private share(): number {
    const { dataStart } = this.header;

    return (this.r.pos - dataStart) / Math.max(1, this.r.end - dataStart);
  }
}
