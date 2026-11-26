import { useMemo } from 'react';

import { buildValidGpsSamples } from '../../dsp/gps/buildValidGpsSamples';
import { gpsAltitudeViridisSegments } from '../../dsp/gps/gpsAltitudeViridisSegments';
import { gpsSampleTimeRange } from '../../dsp/gps/gpsSampleTimeRange';
import { useGpsPlayback } from '../../hooks/useGpsPlayback';
import { colorFor } from '../../logs/colorFor';
import { plotEvents } from '../../logs/plotEvents';
import { shortName } from '../../logs/shortName';
import type { GpsAnalysis, LogSlot, ParsedLog, PlotMarker, PlotSeries } from '../../types';
import { gpsStatTexts } from '../../utils/gpsStatTexts';
import { GpsMapTrack } from './GpsMapTrack';
import { GpsSeriesPlot } from './GpsSeriesPlot';
import { GpsStat } from './GpsStat';

export function GpsLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: GpsAnalysis;
  multi: boolean;
}) {
  const gpsSamples = useMemo(
    () => buildValidGpsSamples(log.gps.time, log.gps.lat, log.gps.lon),
    [log.gps.time, log.gps.lat, log.gps.lon],
  );
  const { tMin: gpsTMin, tMax: gpsTMax } = gpsSampleTimeRange(gpsSamples);

  const playback = useGpsPlayback(gpsTMin, gpsTMax, slot.id);
  const { playbackT } = playback;
  const stats = gpsStatTexts(analysis);
  const events = useMemo(() => plotEvents([{ log, slot }]), [log, slot]);

  const gpsPlaybackMarkers: PlotMarker[] = useMemo(() => {
    if (!(gpsTMax > gpsTMin)) return [];
    return [
      {
        x: playbackT,
        stroke: '#e8eef8',
        width: 1.75,
        dash: [4, 4],
      },
    ];
  }, [playbackT, gpsTMin, gpsTMax]);

  const altitudeSegmentStrokeColors = useMemo(() => {
    if (analysis.maxAltitudeM == null || log.gps.altitude.length < 2) return undefined;
    return gpsAltitudeViridisSegments(log.gps.lat, log.gps.lon, log.gps.altitude, '#5fa8ff');
  }, [analysis.maxAltitudeM, log.gps.lat, log.gps.lon, log.gps.altitude]);

  const altSeries: PlotSeries[] =
    analysis.maxAltitudeM != null
      ? [{ label: 'altitude', values: log.gps.altitude, stroke: '#5fa8ff', width: 1.5 }]
      : [];
  const speedSeries: PlotSeries[] =
    analysis.maxSpeedMs != null ? [{ label: 'speed', values: log.gps.speed, stroke: '#ffaa5d', width: 1.5 }] : [];

  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        <span className="diff-log__vs">
          {stats.distance} · max alt {stats.maxAlt} · max {stats.maxSpeedShort}
        </span>
      </h4>

      <div className="battery-stats">
        <GpsStat label="Distance" value={stats.distance} />
        <GpsStat label="Max alt" value={stats.maxAlt} />
        <GpsStat label="Max speed" value={stats.maxSpeed} />
        <GpsStat label="Avg speed" value={stats.avgSpeed} />
        <GpsStat label="Sats min" value={stats.minSats} />
      </div>

      <div className="axis-plot mt-2">
        <h5 className="axis-plot__title text-[0.78rem]">Ground track</h5>
        <GpsMapTrack
          gpsTime={log.gps.time}
          lat={log.gps.lat}
          lon={log.gps.lon}
          altitude={log.gps.altitude}
          colorByLabel="altitude (m)"
          height={360}
          {...playback}
        />
      </div>

      {altSeries.length > 0 && (
        <GpsSeriesPlot
          title="Altitude (m)"
          time={log.gps.time}
          series={altSeries}
          yLabel="m"
          markers={gpsPlaybackMarkers}
          events={events}
          segmentStrokeColors={altitudeSegmentStrokeColors}
        />
      )}

      {speedSeries.length > 0 && (
        <GpsSeriesPlot
          title="Speed (m/s)"
          time={log.gps.time}
          series={speedSeries}
          yLabel="m/s"
          markers={gpsPlaybackMarkers}
          events={events}
        />
      )}
    </div>
  );
}
