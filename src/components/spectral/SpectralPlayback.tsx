/** Play/pause, time scrubber and speed for the spectrogram cursor. */
export function SpectralPlayback(p: {
  tMin: number;
  tMax: number;
  cursorTime: number | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onScrub: (t: number) => void;
  playSpeed: number;
  onPlaySpeed: (speed: number) => void;
}) {
  return (
    <div className="spec-playback">
      <button type="button" className="spec-playback__btn" onClick={p.onTogglePlay}>
        {p.isPlaying ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={p.tMin}
        max={p.tMax}
        step={(p.tMax - p.tMin) / 2000}
        value={p.cursorTime ?? p.tMin}
        onChange={(e) => p.onScrub(Number.parseFloat(e.target.value))}
        className="spec-playback__slider"
      />
      <span className="spec-playback__time">
        {p.cursorTime != null ? `${p.cursorTime.toFixed(2)} s` : '—'}
        <span className="muted">{` / ${p.tMax.toFixed(2)} s`}</span>
      </span>
      <label className="spec-playback__speed">
        Speed:
        <select value={p.playSpeed} onChange={(e) => p.onPlaySpeed(Number.parseFloat(e.target.value))}>
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </label>
    </div>
  );
}
