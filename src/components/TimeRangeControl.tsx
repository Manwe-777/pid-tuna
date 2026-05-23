import { useEffect, useState } from 'react';
import type { TimeRangeSec } from '../sliceLog';

export interface TimeRangeControlProps {
  /** Maximum end time (seconds) — typically log duration. */
  max: number;
  value: TimeRangeSec;
  onChange: (next: TimeRangeSec) => void;
}

export function TimeRangeControl({ max, value, onChange }: TimeRangeControlProps) {
  // Local string state so user can type freely without value clamps mid-edit.
  const [startStr, setStartStr] = useState(value.start.toFixed(2));
  const [endStr, setEndStr] = useState(value.end.toFixed(2));

  useEffect(() => setStartStr(value.start.toFixed(2)), [value.start]);
  useEffect(() => setEndStr(value.end.toFixed(2)), [value.end]);

  const commitStart = () => {
    const n = clamp(Number.parseFloat(startStr), 0, value.end);
    if (!Number.isFinite(n)) return setStartStr(value.start.toFixed(2));
    onChange({ start: n, end: value.end });
  };
  const commitEnd = () => {
    const n = clamp(Number.parseFloat(endStr), value.start, max);
    if (!Number.isFinite(n)) return setEndStr(value.end.toFixed(2));
    onChange({ start: value.start, end: n });
  };

  const reset = () => onChange({ start: 0, end: max });

  return (
    <div className="time-range">
      <span className="time-range__label">Window:</span>
      <input
        type="number"
        step="0.1"
        min={0}
        max={value.end}
        value={startStr}
        onChange={(e) => setStartStr(e.target.value)}
        onBlur={commitStart}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="time-range__sep">to</span>
      <input
        type="number"
        step="0.1"
        min={value.start}
        max={max}
        value={endStr}
        onChange={(e) => setEndStr(e.target.value)}
        onBlur={commitEnd}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="time-range__unit">s</span>
      <span className="time-range__duration">
        ({(value.end - value.start).toFixed(2)}s of {max.toFixed(2)}s)
      </span>
      <button type="button" className="time-range__reset" onClick={reset}>
        Full log
      </button>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
