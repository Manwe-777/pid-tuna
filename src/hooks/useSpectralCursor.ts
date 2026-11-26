import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Where the cursor goes when the time range changes: kept if still inside, else the middle (or none without data). */
function cursorForRange(cursor: number | null, hasTimes: boolean, tMin: number, tMax: number): number | null {
  if (cursor == null) return hasTimes ? (tMin + tMax) / 2 : null;
  if (cursor < tMin || cursor > tMax) return hasTimes ? (tMin + tMax) / 2 : null;

  return cursor;
}

/** Time cursor over the spectrogram with looping playback. */
export function useSpectralCursor(times: Float32Array | null) {
  const hasTimes = times != null && times.length > 0;
  const tMin = hasTimes ? times[0]! : 0;
  const tMax = hasTimes ? times[times.length - 1]! : 0;
  const [cursorTime, setCursorTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  const rangeKey = `${tMin}|${tMax}`;
  const [seenRange, setSeenRange] = useState<string | null>(null);

  if (seenRange !== rangeKey) {
    setSeenRange(rangeKey);
    const next = cursorForRange(cursorTime, hasTimes, tMin, tMax);
    if (next !== cursorTime) setCursorTime(next);
  }

  // Playback starts from wherever the cursor is when play is pressed.
  const cursorRef = useRef(cursorTime);
  useLayoutEffect(() => {
    cursorRef.current = cursorTime;
  });

  useEffect(() => {
    const start = cursorRef.current;
    if (!isPlaying || start == null || tMax <= tMin) return;
    let raf = 0;
    let lastWall = performance.now();
    let t = start;

    const tick = (now: number) => {
      const dt = (now - lastWall) / 1000;
      lastWall = now;
      t += dt * playSpeed;
      if (t > tMax) t = tMin + (t - tMax);
      setCursorTime(t);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [isPlaying, playSpeed, tMin, tMax]);

  return { hasTimes, tMin, tMax, cursorTime, setCursorTime, isPlaying, setIsPlaying, playSpeed, setPlaySpeed };
}
