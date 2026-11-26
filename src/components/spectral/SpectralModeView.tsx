import { HEATMAP_HEIGHT } from '../../constants';
import type { useSpectralCursor } from '../../hooks/useSpectralCursor';
import type { useSpectralMaps } from '../../hooks/useSpectralMaps';
import type { PlotEvent, SpectralMode } from '../../types';
import { isBinnedMode } from '../../utils/isBinnedMode';
import { isRpmMode } from '../../utils/isRpmMode';
import { BinnedModeNote } from './BinnedModeNote';
import { BinnedSpecPlot } from './BinnedSpecPlot';
import { DensityPlot } from './DensityPlot';
import { ErrorSetpointInfo } from './ErrorSetpointInfo';
import { SpectralTimeView } from './SpectralTimeView';

interface Props {
  mode: SpectralMode;
  maps: ReturnType<typeof useSpectralMaps>;
  cursor: ReturnType<typeof useSpectralCursor>;
  slice: { freq: Float32Array; values: Float32Array } | null;
  axisName: string;
  axisColor: string;
  maxFreq: number;
  floorDb: number;
  ceilDb: number;
  compensateLag: boolean;
  onCompensateLag: (on: boolean) => void;
  events: readonly PlotEvent[];
}

/** The current mode's view: error density, binned heatmap, or the time view with its cursor. */
export function SpectralModeView(p: Props) {
  const { maps, axisName } = p;

  if (p.mode === 'errorSetpoint') {
    return (
      <>
        <ErrorSetpointInfo compensateLag={p.compensateLag} onCompensateLag={p.onCompensateLag} density={maps.density} />
        {maps.density && <DensityPlot data={maps.density} title={axisName} height={HEATMAP_HEIGHT} />}
      </>
    );
  }

  if (isBinnedMode(p.mode)) {
    const rpmMode = isRpmMode(p.mode);

    return (
      <>
        <BinnedModeNote rpmMode={rpmMode} rpmUnavailable={maps.rpmUnavailable} />
        {maps.binned && !maps.rpmUnavailable && (
          <BinnedSpecPlot
            data={maps.binned}
            title={axisName}
            yLabel={rpmMode ? 'motor freq (Hz)' : 'throttle %'}
            maxFreqHz={p.maxFreq}
            dbFloor={p.floorDb}
            dbCeil={p.ceilDb}
            valueUnit={maps.valueMode === 'psd' ? 'dBm/Hz' : 'dB'}
            height={HEATMAP_HEIGHT}
          />
        )}
      </>
    );
  }

  return maps.spec ? (
    <SpectralTimeView
      spec={maps.spec}
      cursor={p.cursor}
      slice={p.slice}
      axisName={axisName}
      axisColor={p.axisColor}
      maxFreq={p.maxFreq}
      floorDb={p.floorDb}
      ceilDb={p.ceilDb}
      events={p.events}
    />
  ) : null;
}
