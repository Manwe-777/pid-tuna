import { formatPlaybackClock } from '../../utils/formatPlaybackClock';

/** Cycles 1× → 2× → 4× → 1×. */
const NEXT_SPEED: Record<number, number> = { 1: 2, 2: 4 };

/** Play/pause, scrubber, elapsed / total time and speed, over the map. */
export function GpsPlaybackControls(p: {
  tMin: number;
  tMax: number;
  playbackT: number;
  onPlaybackTChange: (t: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
}) {
  return (
    <div className="gps-overlay-controls">
      <div className="gps-playback">
        <button
          type="button"
          className="gps-playback__btn"
          onClick={() => p.onPlayingChange(!p.playing)}
          aria-label={p.playing ? 'Pause' : 'Play'}
        >
          {p.playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          className="gps-playback__slider"
          min={p.tMin}
          max={p.tMax}
          step={Math.max(0.02, (p.tMax - p.tMin) / 800)}
          value={p.playbackT}
          aria-label="Playback position"
          onPointerDown={() => p.onPlayingChange(false)}
          onChange={(e) => p.onPlaybackTChange(Number(e.target.value))}
        />
        <span className="gps-playback__time">
          {formatPlaybackClock(p.playbackT - p.tMin)}
          {' / '}
          {formatPlaybackClock(p.tMax - p.tMin)}
        </span>
        <button
          type="button"
          className="gps-playback__speed"
          data-tip="Playback speed"
          onClick={() => p.onPlaybackSpeedChange(NEXT_SPEED[p.playbackSpeed] ?? 1)}
        >
          {p.playbackSpeed === 1 ? '1×' : p.playbackSpeed === 2 ? '2×' : '4×'}
        </button>
      </div>
    </div>
  );
}
