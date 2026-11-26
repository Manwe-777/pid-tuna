import { useCallback, useState } from 'react';

/** Map playback position, play state and speed; position and play state reset when the track changes. */
export function useGpsPlayback(tMin: number, tMax: number, trackId: string) {
  const [playbackT, setPlaybackT] = useState(tMin);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const resetKey = `${tMin}|${tMax}|${trackId}`;
  const [trackKey, setTrackKey] = useState(resetKey);

  if (trackKey !== resetKey) {
    setTrackKey(resetKey);
    setPlaybackT(tMin);
    setPlaying(false);
  }

  return {
    playbackT,
    onPlaybackTChange: useCallback((t: number) => setPlaybackT(t), []),
    playing,
    onPlayingChange: useCallback((next: boolean) => setPlaying(next), []),
    playbackSpeed,
    onPlaybackSpeedChange: useCallback((speed: number) => setPlaybackSpeed(speed), []),
  };
}
