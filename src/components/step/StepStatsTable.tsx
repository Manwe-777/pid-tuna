import { STEP_METRICS } from '../../constants';
import type { StepMetricOption, StepMetrics } from '../../types';
import { formatStepMetric } from '../../utils/formatStepMetric';

export interface StepStatsRow {
  id: string;
  label: string;
  color: string;
  windows: number;
  metrics: StepMetrics;
}

const SENSITIVITY_CAUTION_DB = 4;
const SENSITIVITY_SEVERE_DB = 6;
const LOW_CONFIDENCE = 0.6;
const PHASE_MARGIN_CAUTION = 45;
const PHASE_MARGIN_SEVERE = 30;

/** One cell per metric, each listing every log's value; wraps to fit any width. */
export function StepStatsTable({ rows }: { rows: StepStatsRow[] }) {
  const showDots = rows.length > 1;

  return (
    <div className="step-stats">
      <div className="step-stats__cell" title="Analysis windows pooled into the estimate">
        <div className="step-stats__k">Windows</div>
        {rows.map((row) => (
          <div key={row.id} className="step-stats__v">
            {showDots && <span className="step-stats__dot" style={{ background: row.color }} />}
            {row.windows}
          </div>
        ))}
      </div>
      {STEP_METRICS.map((m) => (
        <div key={m.key} className="step-stats__cell" title={m.help}>
          <div className="step-stats__k">{m.label}</div>
          {rows.map((row) => (
            <div key={row.id} className={`step-stats__v ${toneFor(m.key, row.metrics) ?? ''}`}>
              {showDots && <span className="step-stats__dot" style={{ background: row.color }} />}
              {valueText(m, row.metrics)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function valueText(m: StepMetricOption, metrics: StepMetrics): string {
  const text = formatStepMetric(m, metrics[m.key]);
  if (m.key !== 'sensitivityPeakDb' || metrics.sensitivityPeakHz == null || text === '—') return text;

  return `${text} @ ${metrics.sensitivityPeakHz.toFixed(0)} Hz`;
}

function toneFor(key: keyof StepMetrics, m: StepMetrics): string | undefined {
  if (key === 'sensitivityPeakDb' && m.sensitivityPeakDb != null) {
    if (m.sensitivityPeakDb >= SENSITIVITY_SEVERE_DB) return 'step-stats__bad';
    if (m.sensitivityPeakDb >= SENSITIVITY_CAUTION_DB) return 'step-stats__warn';
  }

  if (key === 'phaseMarginDeg' && m.phaseMarginDeg != null) {
    if (m.phaseMarginDeg < PHASE_MARGIN_SEVERE) return 'step-stats__bad';
    if (m.phaseMarginDeg < PHASE_MARGIN_CAUTION) return 'step-stats__warn';
  }

  if (key === 'confidence' && m.confidence != null && m.confidence < LOW_CONFIDENCE) return 'step-stats__warn';

  return undefined;
}
