import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { GpsAnalysis } from '../../dsp/gps';
import { buildValidGpsSamples } from '../../dsp/gpsPlayback';
import { gpsAltitudeViridisSegments } from '../../dsp/gpsViridis';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogSlot, ParsedLog } from '../../types';
import { GpsMapTrack } from './GpsMapTrack';
import { type PlotMarker, type PlotSeries, TimeSeriesPlot } from '../common/TimeSeriesPlot';
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
  const gpsTMin = gpsSamples[0]?.t ?? 0;
  const gpsTMax = gpsSamples[gpsSamples.length - 1]?.t ?? 0;

  const [playbackT, setPlaybackT] = useState(gpsTMin);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useLayoutEffect(() => {
    setPlaybackT(gpsTMin);
    setPlaying(false);
  }, [gpsTMin, gpsTMax, slot.id]);

  const onPlaybackTChange = useCallback((t: number) => setPlaybackT(t), []);
  const onPlayingChange = useCallback((playingNext: boolean) => setPlaying(playingNext), []);
  const onPlaybackSpeedChange = useCallback((speed: number) => setPlaybackSpeed(speed), []);

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
          {(analysis.totalDistanceM / 1000).toFixed(2)} km · max alt{' '}
          {analysis.maxAltitudeM != null ? `${analysis.maxAltitudeM.toFixed(0)} m` : '—'} · max{' '}
          {analysis.maxSpeedMs != null ? `${analysis.maxSpeedMs.toFixed(1)} m/s` : '—'}
        </span>
      </h4>

      <div className="battery-stats">
        <GpsStat label="Distance" value={`${(analysis.totalDistanceM / 1000).toFixed(2)} km`} />
        <GpsStat
          label="Max alt"
          value={analysis.maxAltitudeM != null ? `${analysis.maxAltitudeM.toFixed(0)} m` : '—'}
        />
        <GpsStat
          label="Max speed"
          value={
            analysis.maxSpeedMs != null
              ? `${analysis.maxSpeedMs.toFixed(1)} m/s · ${(analysis.maxSpeedMs * 3.6).toFixed(0)} km/h`
              : '—'
          }
        />
        <GpsStat
          label="Avg speed"
          value={analysis.meanSpeedMs != null ? `${analysis.meanSpeedMs.toFixed(1)} m/s` : '—'}
        />
        <GpsStat label="Sats min" value={analysis.minSats != null ? `${analysis.minSats}` : '—'} />
      </div>

      <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
        <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
          Ground track
        </h5>
        <GpsMapTrack
          gpsTime={log.gps.time}
          lat={log.gps.lat}
          lon={log.gps.lon}
          altitude={log.gps.altitude}
          colorByLabel="altitude (m)"
          height={360}
          playbackT={playbackT}
          onPlaybackTChange={onPlaybackTChange}
          playing={playing}
          onPlayingChange={onPlayingChange}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={onPlaybackSpeedChange}
        />
      </div>

      {altSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
            Altitude (m)
          </h5>
          <TimeSeriesPlot
            time={log.gps.time}
            series={altSeries}
            yLabel="m"
            height={180}
            showLegend={false}
            markers={gpsPlaybackMarkers}
            segmentStrokeColors={altitudeSegmentStrokeColors}
          />
        </div>
      )}

      {speedSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
            Speed (m/s)
          </h5>
          <TimeSeriesPlot
            time={log.gps.time}
            series={speedSeries}
            yLabel="m/s"
            height={180}
            showLegend={false}
            markers={gpsPlaybackMarkers}
          />
        </div>
      )}
    </div>
  );
}
