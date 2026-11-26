/** Tab title with the mode; with several logs, says only the first is shown. */
export function SpectralHeading({ modeLabel, onlyLog }: { modeLabel: string; onlyLog: string | null }) {
  return (
    <>
      <h2>
        Spectral · {modeLabel}
        {onlyLog != null && ` — showing ${onlyLog} only`}
      </h2>
      {onlyLog != null && (
        <p className="muted">
          Heatmaps can&apos;t overlay — showing the first enabled log only. Use the Full spectrum tab to compare logs as
          line traces.
        </p>
      )}
    </>
  );
}
