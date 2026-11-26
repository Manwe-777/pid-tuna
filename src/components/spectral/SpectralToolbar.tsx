import type { useSpectralSettings } from '../../hooks/useSpectralSettings';
import { isTimeMode } from '../../utils/isTimeMode';
import { maxFreqOptions } from '../../utils/maxFreqOptions';
import { DbRangeControls } from './DbRangeControls';
import { SpectralControls } from './SpectralControls';

/** The Spectral tab's controls, with the dB range in PSD modes that have data. */
export function SpectralToolbar(p: {
  s: ReturnType<typeof useSpectralSettings>;
  hasRaw: boolean;
  nyquist: number;
  showDb: boolean;
  floorDb: number;
  ceilDb: number;
}) {
  const { s } = p;

  return (
    <SpectralControls
      mode={s.mode}
      onMode={s.setMode}
      axis={s.axis}
      onAxis={s.setAxis}
      source={s.source}
      hasRaw={p.hasRaw}
      onSource={s.setSource}
      windowSize={isTimeMode(s.mode) ? s.windowSize : null}
      onWindowSize={s.setWindowSize}
      maxFreq={s.maxFreq}
      maxFreqOptions={maxFreqOptions(p.nyquist)}
      onMaxFreq={s.setMaxFreq}
    >
      {p.showDb && (
        <DbRangeControls
          floorDb={p.floorDb}
          ceilDb={p.ceilDb}
          overridden={s.dbMin != null || s.dbMax != null}
          onMin={s.setDbMin}
          onMax={s.setDbMax}
          onAuto={s.resetDb}
        />
      )}
    </SpectralControls>
  );
}
