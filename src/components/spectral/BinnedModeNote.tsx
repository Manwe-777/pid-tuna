/** What the binned heatmap shows, or why RPM mode is unavailable. */
export function BinnedModeNote({ rpmMode, rpmUnavailable }: { rpmMode: boolean; rpmUnavailable: boolean }) {
  if (rpmUnavailable) {
    return (
      <p className="muted">
        This mode needs eRPM telemetry (BiDirectional DSHOT), which isn&apos;t present in this log.
      </p>
    );
  }

  return (
    <p className="muted">
      {rpmMode
        ? 'Gyro spectrum (X) binned by mean motor rotation frequency (Y, from eRPM telemetry). Diagonal streaks are RPM-tracking noise and its harmonics; the RPM/Hz axis is approximate.'
        : 'Gyro spectrum (X) binned by throttle (Y) — vertical streaks reveal throttle/RPM-correlated motor noise.'}
    </p>
  );
}
