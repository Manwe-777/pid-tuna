import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';

import { DRONE_SVG } from '../../constants';

export function PlaybackDroneMarker({
  position,
  headingDeg,
  followWhilePlaying,
  playing,
}: {
  position: [number, number] | null;
  headingDeg: number;
  followWhilePlaying: boolean;
  playing: boolean;
}) {
  const map = useMap();
  const lastPanMs = useRef(0);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'gps-drone-marker',
        html:
          `<div class="gps-drone-marker__rotate" style="transform:rotate(${headingDeg}deg)">` + DRONE_SVG + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [headingDeg],
  );

  useEffect(() => {
    if (!playing || !followWhilePlaying || !position) return;
    const now = performance.now();
    if (now - lastPanMs.current < 140) return;
    lastPanMs.current = now;
    map.panTo(position, { animate: false });
  }, [playing, followWhilePlaying, position, map]);

  if (!position) return null;
  return <Marker position={position} icon={icon} zIndexOffset={700} />;
}
