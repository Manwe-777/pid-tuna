import { useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';

import { MAP_MAX_ZOOM, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../constants';
import { buildValidGpsSamples } from '../../dsp/gps/buildValidGpsSamples';
import { gpsDefaultMapSmoothSettings } from '../../dsp/gps/gpsDefaultMapSmoothSettings';
import { gpsSampleTimeRange } from '../../dsp/gps/gpsSampleTimeRange';
import { gpsTrackOverlay } from '../../dsp/gps/gpsTrackOverlay';
import { headingAlongTrack } from '../../dsp/gps/headingAlongTrack';
import { interpolateGps } from '../../dsp/gps/interpolateGps';
import { smoothLonLatForMap } from '../../dsp/gps/smoothLonLatForMap';
import { usePlaybackClock } from '../../hooks/usePlaybackClock';
import { FitTrackBounds } from './FitTrackBounds';
import { GpsAltitudeLegend } from './GpsAltitudeLegend';
import { GpsPlaybackControls } from './GpsPlaybackControls';
import { InvalidateSizeOnResize } from './InvalidateSizeOnResize';
import { PlaybackDroneMarker } from './PlaybackDroneMarker';

interface GpsMapTrackProps {
  gpsTime: Float32Array;
  lat: Float32Array;
  lon: Float32Array;
  altitude?: Float32Array;
  colorByLabel?: string;
  height?: number;
  stroke?: string;
  /** Absolute GPS time matching `gpsTime`, same semantics as scrubber playback. */
  playbackT: number;
  onPlaybackTChange: (t: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
}

/** Start (green) or end (red) of the track. */
function TrackEnd({ at, fill }: { at: [number, number] | null; fill: string }) {
  if (!at) return null;

  return (
    <CircleMarker center={at} radius={6} pathOptions={{ color: '#fff', fillColor: fill, fillOpacity: 1, weight: 2 }} />
  );
}

/** Map + GPS track with scrubber playback and direction-of-travel arrow (from the GPS path, not gyro). */
export function GpsMapTrack({
  gpsTime,
  lat,
  lon,
  altitude,
  colorByLabel = 'altitude',
  height = 360,
  stroke = '#5fa8ff',
  playbackT,
  onPlaybackTChange,
  playing,
  onPlayingChange,
  playbackSpeed,
  onPlaybackSpeedChange,
}: GpsMapTrackProps) {
  const smoothSettings = useMemo(() => gpsDefaultMapSmoothSettings(), []);

  const { lat: latDisp, lon: lonDisp } = useMemo(
    () => smoothLonLatForMap(lat, lon, smoothSettings),
    [lat, lon, smoothSettings],
  );

  const samples = useMemo(() => buildValidGpsSamples(gpsTime, latDisp, lonDisp), [gpsTime, latDisp, lonDisp]);
  const { tMin, tMax } = gpsSampleTimeRange(samples);

  usePlaybackClock({ playing, playbackT, tMin, tMax, speed: playbackSpeed, onPlaybackTChange, onPlayingChange });

  const track = useMemo(
    () => gpsTrackOverlay(latDisp, lonDisp, altitude, stroke, smoothSettings.crsChordSteps),
    [latDisp, lonDisp, altitude, stroke, smoothSettings],
  );
  const dronePos = useMemo(() => interpolateGps(samples, playbackT), [samples, playbackT]);
  const headingDeg = useMemo(() => headingAlongTrack(samples, playbackT), [samples, playbackT]);

  if (track.segments.length === 0) {
    return (
      <div className="gps-map gps-map--empty muted" style={{ height }}>
        No GPS coordinates with a fix in this window.
      </div>
    );
  }

  const droneLatLng: [number, number] | null = dronePos != null ? [dronePos[0], dronePos[1]] : null;

  return (
    <div className="gps-map-wrap" style={{ height }}>
      <MapContainer center={track.center} zoom={14} scrollWheelZoom className="gps-map h-full w-full">
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} maxZoom={MAP_MAX_ZOOM} />
        <InvalidateSizeOnResize />
        <FitTrackBounds boundsPoints={track.boundsPoints} anchorLat={lat} anchorLon={lon} anchorGpsTime={gpsTime} />
        {track.segments.map((s, idx) => (
          <Polyline key={idx} positions={s.positions} pathOptions={{ color: s.color, weight: 3, opacity: 0.92 }} />
        ))}
        <TrackEnd at={track.startMark} fill="#5dff8a" />
        <TrackEnd at={track.endMark} fill="#ff7070" />
        <PlaybackDroneMarker position={droneLatLng} headingDeg={headingDeg} followWhilePlaying playing={playing} />
      </MapContainer>

      {track.legend && <GpsAltitudeLegend label={colorByLabel} min={track.legend.min} max={track.legend.max} />}

      <GpsPlaybackControls
        tMin={tMin}
        tMax={tMax}
        playbackT={playbackT}
        onPlaybackTChange={onPlaybackTChange}
        playing={playing}
        onPlayingChange={onPlayingChange}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={onPlaybackSpeedChange}
      />
    </div>
  );
}
