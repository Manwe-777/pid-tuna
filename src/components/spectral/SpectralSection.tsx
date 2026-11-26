import { useMemo } from 'react';

import { SPECTRAL_MODES } from '../../constants';
import { useSpectralCursor } from '../../hooks/useSpectralCursor';
import { useSpectralMaps } from '../../hooks/useSpectralMaps';
import { useSpectralSettings } from '../../hooks/useSpectralSettings';
import { plotEvents } from '../../logs/plotEvents';
import { shortName } from '../../logs/shortName';
import type { LogEntry } from '../../types';
import { spectralAxisLabel } from '../../utils/spectralAxisLabel';
import { spectralDbRange } from '../../utils/spectralDbRange';
import { spectrumSliceAt } from '../../utils/spectrumSliceAt';
import { SpectralHeading } from './SpectralHeading';
import { SpectralModeView } from './SpectralModeView';
import { SpectralToolbar } from './SpectralToolbar';

export function SpectralSection({ entries }: { entries: LogEntry[] }) {
  const log = entries[0]!.log;
  const nyquist = Math.floor(log.setup.sampleRateHz / 2);
  const hasRaw = useMemo(() => log.gyroRaw.some((arr) => arr.some((v) => v !== 0)), [log]);
  const s = useSpectralSettings(nyquist, hasRaw);
  const maps = useSpectralMaps(log, s);
  const { floorDb, ceilDb } = spectralDbRange(maps.valueMode, maps.autoRange, s.dbMin, s.dbMax);
  const cursor = useSpectralCursor(maps.spec?.times ?? null);
  const slice = useMemo(() => spectrumSliceAt(maps.spec, cursor.cursorTime), [maps.spec, cursor.cursorTime]);
  const axisLabel = spectralAxisLabel(s.axis);
  const events = useMemo(() => plotEvents([entries[0]!]), [entries]);

  return (
    <section className="plot-section">
      <SpectralHeading
        modeLabel={SPECTRAL_MODES.find((m) => m.id === s.mode)?.label ?? ''}
        onlyLog={entries.length > 1 ? shortName(entries[0]!.slot) : null}
      />
      <SpectralToolbar
        s={s}
        hasRaw={hasRaw}
        nyquist={nyquist}
        showDb={maps.valueMode === 'psd' && !maps.rpmUnavailable}
        floorDb={floorDb}
        ceilDb={ceilDb}
      />
      <SpectralModeView
        mode={s.mode}
        maps={maps}
        cursor={cursor}
        slice={slice}
        axisName={axisLabel.name}
        axisColor={axisLabel.color}
        maxFreq={s.maxFreq}
        floorDb={floorDb}
        ceilDb={ceilDb}
        compensateLag={s.compensateLag}
        onCompensateLag={s.setCompensateLag}
        events={events}
      />
    </section>
  );
}
