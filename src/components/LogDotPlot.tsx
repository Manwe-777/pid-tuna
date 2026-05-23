import { useMemo } from 'react';

export interface LogDot {
  label: string;
  color: string;
  /** Null = "no data" — shown as a muted hollow ring on the baseline. */
  value: number | null;
}

export interface LogDotPlotProps {
  dots: LogDot[];
  /** Title shown above the plot, e.g. "Roll Peak". */
  title: string;
  /** Y-axis unit suffix shown in the title (e.g. "ms"). */
  unit?: string;
  /** Optional Y reference line (e.g. 1.0 for peak). */
  referenceY?: number;
  /** Force a minimum Y range — useful for "peak" where 0.85–1.25 is the meaningful band. */
  yMin?: number;
  yMax?: number;
  width?: number;
  height?: number;
}

/**
 * Compact scatter plot showing one dot per log along an integer X axis. Used to
 * compare a per-log metric (peak response, latency) across the loaded logs at a
 * glance. Each dot uses the log's color.
 */
export function LogDotPlot({
  dots,
  title,
  unit,
  referenceY,
  yMin,
  yMax,
  width = 220,
  height = 160,
}: LogDotPlotProps) {
  // Bottom padding fits both the tick labels and the axis title with breathing room.
  const PAD = { top: 24, right: 14, bottom: 42, left: 38 };
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const chartBottom = PAD.top + innerH;
  // X-axis description color — slightly darker than tick text so the axis title recedes.
  const AXIS_TICK_FILL = '#6c7383';
  const AXIS_LABEL_FILL = '#5a6473';

  const { effYMin, effYMax, yTicks } = useMemo(() => {
    const validValues = dots.map((d) => d.value).filter((v): v is number => v != null);
    let lo: number;
    let hi: number;
    if (validValues.length === 0) {
      lo = yMin ?? 0;
      hi = yMax ?? 1;
    } else {
      const dMin = Math.min(...validValues);
      const dMax = Math.max(...validValues);
      const pad = Math.max((dMax - dMin) * 0.25, Math.abs(dMax) * 0.05, 1);
      lo = yMin ?? dMin - pad;
      hi = yMax ?? dMax + pad;
      if (referenceY != null) {
        lo = Math.min(lo, referenceY - pad * 0.5);
        hi = Math.max(hi, referenceY + pad * 0.5);
      }
      if (hi - lo < 1e-6) { lo -= 0.5; hi += 0.5; }
    }
    return { effYMin: lo, effYMax: hi, yTicks: niceTicks(lo, hi, 5) };
  }, [dots, yMin, yMax, referenceY]);

  const xCount = Math.max(dots.length, 1);
  // Inset so end dots don't kiss the frame.
  const X_INSET = 18;
  const xPos = (i: number) => {
    if (xCount === 1) return PAD.left + innerW / 2;
    const usableW = Math.max(1, innerW - 2 * X_INSET);
    return PAD.left + X_INSET + (i / (xCount - 1)) * usableW;
  };
  const yPos = (v: number) => {
    const t = (v - effYMin) / (effYMax - effYMin || 1);
    return PAD.top + (1 - t) * innerH;
  };

  return (
    <svg width={width} height={height} className="log-dot-plot">
      <text
        x={PAD.left}
        y={14}
        fill="#c8ced9"
        fontSize="12"
        fontWeight="600"
      >
        {title}{unit ? ` (${unit})` : ''}
      </text>

      <rect
        x={PAD.left}
        y={PAD.top}
        width={innerW}
        height={innerH}
        fill="none"
        stroke="#1d242e"
      />

      {yTicks.map((t) => {
        const y = yPos(t);
        return (
          <g key={`y-${t}`}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y}
              y2={y}
              stroke="#1d242e"
            />
            <text
              x={PAD.left - 4}
              y={y + 3}
              fill="#8a93a3"
              fontSize="10"
              textAnchor="end"
            >
              {formatTick(t)}
            </text>
          </g>
        );
      })}

      {referenceY != null && referenceY >= effYMin && referenceY <= effYMax && (
        <line
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={yPos(referenceY)}
          y2={yPos(referenceY)}
          stroke="#3a4150"
          strokeDasharray="3 3"
        />
      )}

      {dots.map((d, i) => {
        const x = xPos(i);
        const tickY = chartBottom + 14;
        if (d.value == null) {
          return (
            <g key={i}>
              <text
                x={x}
                y={tickY}
                fill={AXIS_TICK_FILL}
                fontSize="10"
                textAnchor="middle"
              >
                {i + 1}
              </text>
              <circle
                cx={x}
                cy={chartBottom - 4}
                r={3}
                fill="none"
                stroke="#3a4150"
                strokeDasharray="2 2"
              />
            </g>
          );
        }
        return (
          <g key={i}>
            <text
              x={x}
              y={tickY}
              fill={AXIS_TICK_FILL}
              fontSize="10"
              textAnchor="middle"
            >
              {i + 1}
            </text>
            <circle cx={x} cy={yPos(d.value)} r={5} fill={d.color} />
            <title>{`${d.label}: ${d.value.toFixed(2)}${unit ? ' ' + unit : ''}`}</title>
          </g>
        );
      })}

      <text
        x={PAD.left + innerW / 2}
        y={chartBottom + 30}
        fill={AXIS_LABEL_FILL}
        fontSize="10"
        textAnchor="middle"
      >
        log #
      </text>
    </svg>
  );
}

function niceTicks(min: number, max: number, target: number): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const out: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function formatTick(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(2);
}
