import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { GPS_VIRIDIS_STOPS } from '../../constants';
import { buildValidGpsSamples } from '../../dsp/gps/buildValidGpsSamples';
import { denseLonLatChord } from '../../dsp/gps/denseLonLatChord';
import { gpsCoordValid } from '../../dsp/gps/gpsCoordValid';
import { gpsDefaultMapSmoothSettings } from '../../dsp/gps/gpsDefaultMapSmoothSettings';
import { gpsDisplayProjection } from '../../dsp/gps/gpsDisplayProjection';
import { gpsViridisColor } from '../../dsp/gps/gpsViridisColor';
import { headingAlongTrack } from '../../dsp/gps/headingAlongTrack';
import { interpolateGps } from '../../dsp/gps/interpolateGps';
import { smoothLonLatForMap } from '../../dsp/gps/smoothLonLatForMap';
import { FitTrackBounds } from './FitTrackBounds';
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

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

function fmtPlaybackClock(secFromStart: number): string {
  const s = Math.max(0, secFromStart);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const rs = r < 10 ? `0${r.toFixed(1)}` : r.toFixed(1);
  return `${m}:${rs}`;
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

  const tMin = samples[0]?.t ?? 0;
  const tMax = samples[samples.length - 1]?.t ?? 0;

  const playbackTRef = useRef(playbackT);
  playbackTRef.current = playbackT;

  useEffect(() => {
    if (!playing) return;
    if (playbackT >= tMax - 1e-5) onPlayingChange(false);
  }, [playbackT, playing, tMax, onPlayingChange]);

  useEffect(() => {
    if (!playing || tMax <= tMin) return;
    let raf = 0;
    let prevWall = performance.now();
    const tick = (wall: number) => {
      const dt = (wall - prevWall) / 1000;
      prevWall = wall;
      const cur = playbackTRef.current;
      onPlaybackTChange(Math.min(tMax, cur + dt * playbackSpeed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, tMin, tMax, playbackSpeed, onPlaybackTChange]);

  const speedLabel = playbackSpeed === 1 ? '1×' : playbackSpeed === 2 ? '2×' : '4×';

  const { segments, boundsPoints, startMark, endMark, center, legendMin, legendMax, showLegend } = useMemo(() => {
    let startMarkInner: [number, number] | null = null;
    let endMarkInner: [number, number] | null = null;
    for (let i = 0; i < latDisp.length; i++) {
      const la = latDisp[i]!;
      const lo = lonDisp[i]!;
      if (gpsCoordValid(la, lo)) {
        startMarkInner = [la, lo];
        break;
      }
    }
    for (let i = latDisp.length - 1; i >= 0; i--) {
      const la = latDisp[i]!;
      const lo = lonDisp[i]!;
      if (gpsCoordValid(la, lo)) {
        endMarkInner = [la, lo];
        break;
      }
    }

    let cMin = Infinity;
    let cMax = -Infinity;
    if (altitude) {
      for (let i = 0; i < latDisp.length; i++) {
        if (!gpsCoordValid(latDisp[i]!, lonDisp[i]!)) continue;
        const v = altitude[i]!;
        if (!Number.isFinite(v)) continue;
        if (v < cMin) cMin = v;
        if (v > cMax) cMax = v;
      }
    }
    const colorize = altitude && Number.isFinite(cMin) && cMax !== -Infinity && cMax > cMin;

    const proj = gpsDisplayProjection(latDisp, lonDisp);

    const segmentsInner: { positions: [number, number][]; color: string }[] = [];
    const boundsPts: [number, number][] = [];

    for (let i = 1; i < latDisp.length; i++) {
      const la0 = latDisp[i - 1]!;
      const lo0 = lonDisp[i - 1]!;
      const la1 = latDisp[i]!;
      const lo1 = lonDisp[i]!;
      if (!gpsCoordValid(la0, lo0) || !gpsCoordValid(la1, lo1)) continue;

      const positions: [number, number][] =
        proj != null
          ? denseLonLatChord(
              latDisp,
              lonDisp,
              i - 1,
              i,
              proj.centerLat,
              proj.centerLon,
              proj.mPerDegLon,
              smoothSettings.crsChordSteps,
            )
          : [
              [la0, lo0],
              [la1, lo1],
            ];
      for (const pt of positions) boundsPts.push(pt);

      let segColor = stroke;
      if (colorize && altitude) {
        const av = (altitude[i - 1]! + altitude[i]!) / 2;
        segColor = gpsViridisColor(av, cMin, cMax, stroke);
      }
      segmentsInner.push({ positions, color: segColor });
    }

    const centerPt: [number, number] = startMarkInner ?? [0, 0];
    const showLegendInner = Boolean(colorize && altitude);

    return {
      segments: segmentsInner,
      boundsPoints: boundsPts,
      startMark: startMarkInner,
      endMark: endMarkInner,
      center: centerPt,
      legendMin: showLegendInner ? cMin : null,
      legendMax: showLegendInner ? cMax : null,
      showLegend: showLegendInner,
    };
  }, [latDisp, lonDisp, altitude, stroke, smoothSettings]);

  const dronePos = useMemo(() => interpolateGps(samples, playbackT), [samples, playbackT]);

  const headingDeg = useMemo(() => headingAlongTrack(samples, playbackT), [samples, playbackT]);

  if (segments.length === 0) {
    return (
      <div className="gps-map gps-map--empty muted" style={{ height }}>
        No GPS coordinates with a fix in this window.
      </div>
    );
  }

  const droneLatLng: [number, number] | null = dronePos != null ? [dronePos[0], dronePos[1]] : null;

  return (
    <div className="gps-map-wrap" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        className="gps-map"
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={20} />
        <InvalidateSizeOnResize />
        <FitTrackBounds boundsPoints={boundsPoints} anchorLat={lat} anchorLon={lon} anchorGpsTime={gpsTime} />
        {segments.map((s, idx) => (
          <Polyline key={idx} positions={s.positions} pathOptions={{ color: s.color, weight: 3, opacity: 0.92 }} />
        ))}
        {startMark && (
          <CircleMarker
            center={startMark}
            radius={6}
            pathOptions={{
              color: '#fff',
              fillColor: '#5dff8a',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
        {endMark && (
          <CircleMarker
            center={endMark}
            radius={6}
            pathOptions={{
              color: '#fff',
              fillColor: '#ff7070',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
        <PlaybackDroneMarker position={droneLatLng} headingDeg={headingDeg} followWhilePlaying playing={playing} />
      </MapContainer>

      {showLegend && legendMin != null && legendMax != null && (
        <div className="gps-map-legend" aria-hidden>
          <span className="gps-map-legend__label">{colorByLabel}</span>
          <div className="gps-map-legend__bar">
            {GPS_VIRIDIS_STOPS.map((c, i) => (
              <span key={i} className="gps-map-legend__swatch" style={{ background: c }} />
            ))}
          </div>
          <div className="gps-map-legend__ticks">
            <span>{legendMin.toFixed(0)}</span>
            <span>{legendMax.toFixed(0)}</span>
          </div>
        </div>
      )}

      <div className="gps-overlay-controls">
        <div className="gps-playback">
          <button
            type="button"
            className="gps-playback__btn"
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            className="gps-playback__slider"
            min={tMin}
            max={tMax}
            step={Math.max(0.02, (tMax - tMin) / 800)}
            value={playbackT}
            aria-label="Playback position"
            onPointerDown={() => onPlayingChange(false)}
            onChange={(e) => onPlaybackTChange(Number(e.target.value))}
          />
          <span className="gps-playback__time">
            {fmtPlaybackClock(playbackT - tMin)}
            {' / '}
            {fmtPlaybackClock(tMax - tMin)}
          </span>
          <button
            type="button"
            className="gps-playback__speed"
            title="Playback speed"
            onClick={() => onPlaybackSpeedChange(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 4 : 1)}
          >
            {speedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
