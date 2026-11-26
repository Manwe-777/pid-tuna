import { GPS_VIRIDIS_STOPS } from '../../constants';

/** Colour scale for the altitude-coloured track. */
export function GpsAltitudeLegend({ label, min, max }: { label: string; min: number; max: number }) {
  return (
    <div className="gps-map-legend" aria-hidden>
      <span className="gps-map-legend__label">{label}</span>
      <div className="gps-map-legend__bar">
        {GPS_VIRIDIS_STOPS.map((c, i) => (
          <span key={i} className="gps-map-legend__swatch" style={{ background: c }} />
        ))}
      </div>
      <div className="gps-map-legend__ticks">
        <span>{min.toFixed(0)}</span>
        <span>{max.toFixed(0)}</span>
      </div>
    </div>
  );
}
