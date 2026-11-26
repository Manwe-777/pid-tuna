import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Fits the viewport only when the underlying raw GPS buffers change (new log slice),
 * so replays/UI that don't swap the log anchors don't reset user pan/zoom.
 */
export function FitTrackBounds({
  boundsPoints,
  anchorLat,
  anchorLon,
  anchorGpsTime,
}: {
  boundsPoints: [number, number][];
  anchorLat: Float32Array;
  anchorLon: Float32Array;
  anchorGpsTime: Float32Array;
}) {
  const map = useMap();
  const pointsRef = useRef(boundsPoints);
  pointsRef.current = boundsPoints;

  useEffect(() => {
    const points = pointsRef.current;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0]!, 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 17 });
    // Denser draw paths change boundsPoints without changing anchors — avoids zoom reset.
  }, [map, anchorLat, anchorLon, anchorGpsTime]);
  return null;
}
