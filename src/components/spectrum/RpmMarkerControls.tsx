import { MOTOR_COLORS } from '../../constants';

interface Props {
  hasRpm: boolean;
  perMotor: Array<{ index: number; meanHz: number | null }>;
  enabledMotors: ReadonlySet<number>;
  toggleMotor: (i: number) => void;
  polePairs: number;
  setPolePairs: (n: number) => void;
  blades: number;
  setBlades: (n: number) => void;
  harmonics: number;
  setHarmonics: (n: number) => void;
}

function SmallNumber(props: {
  label: string;
  value: number;
  max: number;
  fallback: string;
  onChange: (n: number) => void;
}) {
  return (
    <label>
      {props.label}:
      <input
        type="number"
        min={1}
        max={props.max}
        step="1"
        value={props.value}
        onChange={(e) => props.onChange(Math.max(1, Number.parseInt(e.target.value || props.fallback, 10)))}
        style={{ width: '3.5rem' }}
      />
    </label>
  );
}

/** Per-motor toggles (with mean motor frequency) and the pole pairs, blades and harmonics the markers use. */
export function RpmMarkerControls(p: Props) {
  return (
    <div className="rpm-markers">
      <span className="rpm-markers__title">RPM markers:</span>
      {!p.hasRpm ? (
        <span className="muted">No eRPM telemetry in this log (needs BiDirectional DSHOT).</span>
      ) : (
        <>
          {p.perMotor.map(({ index, meanHz }) => {
            const checked = p.enabledMotors.has(index);
            const color = MOTOR_COLORS[index % MOTOR_COLORS.length]!;

            return (
              <label key={index} className={`rpm-motor${checked ? ' rpm-motor--on' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => p.toggleMotor(index)} />
                <span className="signal-chip__swatch" style={{ background: color }} />M{index + 1}
                {meanHz != null && <span className="rpm-motor__hz">{meanHz.toFixed(0)} Hz</span>}
              </label>
            );
          })}
          <SmallNumber label="Pole pairs" value={p.polePairs} max={20} fallback="7" onChange={p.setPolePairs} />
          <SmallNumber label="Blades" value={p.blades} max={6} fallback="2" onChange={p.setBlades} />
          <SmallNumber label="Harmonics" value={p.harmonics} max={6} fallback="3" onChange={p.setHarmonics} />
        </>
      )}
    </div>
  );
}
