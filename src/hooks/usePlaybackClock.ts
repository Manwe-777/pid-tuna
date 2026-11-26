import { useEffect, useLayoutEffect, useRef } from 'react';

/** Advances playback with animation frames while playing, and stops at the end. */
export function usePlaybackClock(p: {
  playing: boolean;
  playbackT: number;
  tMin: number;
  tMax: number;
  speed: number;
  onPlaybackTChange: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const { playing, playbackT, tMin, tMax, speed, onPlaybackTChange, onPlayingChange } = p;
  const playbackTRef = useRef(playbackT);
  useLayoutEffect(() => {
    playbackTRef.current = playbackT;
  });

  useEffect(() => {
    if (!playing) return;
    if (playbackT >= tMax - 1e-5) onPlayingChange(false);
  }, [playbackT, playing, tMax, onPlayingChange]);

  useEffect(() => {
    if (!playing || tMax <= tMin) return;
    let raf = 0;
    let prevWall = performance.now();

    const tick = (wall: number) => {
      const dt = (wall - prevWall) / 1000;
      prevWall = wall;
      onPlaybackTChange(Math.min(tMax, playbackTRef.current + dt * speed));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [playing, tMin, tMax, speed, onPlaybackTChange]);
}
