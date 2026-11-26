import { useMemo } from 'react';
import { analyzeGps } from '../../dsp/gps/analyzeGps';
import { gpsViewerEffectiveRange } from '../../dsp/gps/gpsViewerEffectiveRange';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import { sliceLog } from '../../logs/sliceLog';
import type { LogSlot, ParsedLog, TimeRangeSec } from '../../types';
import { GpsLogCard } from './GpsLogCard';

export function GpsSection({
  sources,
  windowRange,
}: {
  sources: Array<{ slot: LogSlot; log: ParsedLog }>;
  windowRange: TimeRangeSec;
}) {
  const multi = sources.length > 1;

  const analyses = useMemo(
    () =>
      sources.map(({ slot, log }) => {
        const view = sliceLog(log, gpsViewerEffectiveRange(log, windowRange));
        return { slot, log: view, analysis: analyzeGps(view.gps) };
      }),
    [sources, windowRange],
  );

  const anyFix = analyses.some((a) => a.analysis.hasFix);
  if (!anyFix) {
    return (
      <section className="plot-section">
        <h2>GPS</h2>
        <p className="muted">
          No GPS frames in any loaded log. The flight controller&apos;s GPS feature must be enabled and the receiver
          must have a fix at log time.
        </p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>GPS</h2>
      <p className="muted">
        Follow the route on the map — green and red dots are the ends of this window. Playback walks the path over time;
        the arrow shows which way you were moving along the line (from the GPS track shape). Altitude colors the track
        when it&apos;s in the log. The GPS tab uses the time bar above intersected with the flight: it hides the usual
        pre-lock plateau (e.g. altitude stuck at zero) so plots start where the receiver becomes useful, without
        changing other tabs. The map applies a fixed light smoothing on lat/lon for display only (altitude/speed plots
        stay on raw latch samples).
      </p>
      {analyses.map(({ slot, log, analysis }) =>
        analysis.hasFix ? (
          <GpsLogCard key={slot.id} slot={slot} log={log} analysis={analysis} multi={multi} />
        ) : (
          <div key={slot.id} className="diff-log">
            <h4 className="diff-log__head">
              {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
              <span className="diff-log__name">{shortName(slot)}</span>
              <span className="diff-log__vs">no fix</span>
            </h4>
            <p className="muted">No GPS frames in this log.</p>
          </div>
        ),
      )}
    </section>
  );
}
