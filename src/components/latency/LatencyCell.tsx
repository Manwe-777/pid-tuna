import type { LatencyResult } from '../../types';

export function LatencyCell({ result }: { result: LatencyResult }) {
  if (!result.reliable) {
    return (
      <span className="muted" title={`Corr ${result.correlation.toFixed(2)}`}>
        {result.lagMs.toFixed(1)} ms
      </span>
    );
  }
  return <span title={`Correlation ${result.correlation.toFixed(2)}`}>{result.lagMs.toFixed(1)} ms</span>;
}
