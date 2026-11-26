import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [map]);
  return null;
}
