import { HEATMAP_HEIGHT } from '../../constants';
import type { useSpectralCursor } from '../../hooks/useSpectralCursor';
import type { SpectrogramResult } from '../../types';
import { SpectralPlayback } from './SpectralPlayback';
import { SpectralSlicePlot } from './SpectralSlicePlot';
import { SpectrogramPlot } from './SpectrogramPlot';

interface Props {
  spec: SpectrogramResult;
  cursor: ReturnType<typeof useSpectralCursor>;
  slice: { freq: Float32Array; values: Float32Array } | null;
  axisName: string;
  axisColor: string;
  maxFreq: number;
  floorDb: number;
  ceilDb: number;
}

/** Time modes: playback bar, the spectrum at the cursor, and the time × frequency heatmap. */
export function SpectralTimeView({ spec, cursor, slice, axisName, axisColor, maxFreq, floorDb, ceilDb }: Props) {
  return (
    <>
      {cursor.hasTimes && (
        <SpectralPlayback
          tMin={cursor.tMin}
          tMax={cursor.tMax}
          cursorTime={cursor.cursorTime}
          isPlaying={cursor.isPlaying}
          onTogglePlay={() => cursor.setIsPlaying((p) => !p)}
          onScrub={(t) => {
            cursor.setIsPlaying(false);
            cursor.setCursorTime(t);
          }}
          playSpeed={cursor.playSpeed}
          onPlaySpeed={cursor.setPlaySpeed}
        />
      )}

      {slice && (
        <SpectralSlicePlot
          slice={slice}
          cursorTime={cursor.cursorTime}
          label={axisName}
          color={axisColor}
          maxFreq={maxFreq}
          floorDb={floorDb}
          ceilDb={ceilDb}
        />
      )}

      <SpectrogramPlot
        data={spec}
        title={axisName}
        maxFreqHz={maxFreq}
        floorDb={floorDb}
        ceilDb={ceilDb}
        cursorTime={cursor.cursorTime ?? undefined}
        height={HEATMAP_HEIGHT}
      />
    </>
  );
}
