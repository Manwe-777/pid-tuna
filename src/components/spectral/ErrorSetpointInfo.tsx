import type { ErrorSetpointResult } from '../../types';

/** How to read the error density, the latency toggle, and the RMS error and tracking slope. */
export function ErrorSetpointInfo({
  compensateLag,
  onCompensateLag,
  density,
}: {
  compensateLag: boolean;
  onCompensateLag: (on: boolean) => void;
  density: ErrorSetpointResult | null;
}) {
  const slope = density?.trackingSlope;

  return (
    <>
      <p className="muted">
        Tracking-error density, takeoff to landing: error = setpoint − gyro (deg/s) against commanded setpoint. The
        orange line is the mean error at each setpoint. A cloud centred on the dashed error = 0 line means gyro reaches
        setpoint; a line tilting up to the right means it falls short at high rates. With latency compensated, the
        stick-to-gyro delay is taken out first, so what remains is tracking, not lag.
      </p>
      <div className="controls">
        <label data-tip="Compare setpoint with gyro shifted back by the measured tracking latency">
          <input type="checkbox" checked={compensateLag} onChange={(e) => onCompensateLag(e.target.checked)} />
          Compensate latency
        </label>
        {density && density.rmsError != null && (
          <span className="muted">
            RMS error {density.rmsError.toFixed(1)} deg/s
            {slope != null &&
              ` · over the whole flight gyro averages ${((1 - slope) * 100).toFixed(0)}% of setpoint (slope ${slope.toFixed(3)}; the Step response "level" is the shorter 200–500 ms view)`}
          </span>
        )}
      </div>
    </>
  );
}
