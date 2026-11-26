import type { ReactNode } from 'react';

import type { LogEntry, LogSlot, ParsedLog, TabId, TimeRangeSec } from '../../types';
import { BalanceSection } from '../balance/BalanceSection';
import { BatterySection } from '../battery/BatterySection';
import { PlotSyncScope } from '../common/PlotSyncScope';
import { DiffSummarySection } from '../diff/DiffSummarySection';
import { FilterSimulatorSection } from '../filters/FilterSimulatorSection';
import { GpsSection } from '../gps/GpsSection';
import { LatencySection } from '../latency/LatencySection';
import { SaturationSection } from '../saturation/SaturationSection';
import { ScorecardSection } from '../scorecard/ScorecardSection';
import { SpectralSection } from '../spectral/SpectralSection';
import { FullSpectrumSection } from '../spectrum/FullSpectrumSection';
import { StepResponseSection } from '../step/StepResponseSection';
import { TuneSettingsPanel } from '../tune/TuneSettingsPanel';
import { LogViewerSection } from '../viewer/LogViewerSection';

interface Props {
  tab: TabId;
  entries: LogEntry[];
  /** Whole logs, for the GPS tab, which windows its own way. */
  enabled: Array<{ slot: LogSlot; log: ParsedLog }>;
  range: TimeRangeSec;
  onJump: (tab: TabId) => void;
}

const SECTIONS: Record<TabId, (p: Props) => ReactNode> = {
  scorecard: (p) => <ScorecardSection entries={p.entries} onJump={p.onJump} />,
  viewer: (p) => <LogViewerSection entries={p.entries} />,
  saturation: (p) => <SaturationSection entries={p.entries} />,
  balance: (p) => <BalanceSection entries={p.entries} />,
  battery: (p) => <BatterySection entries={p.entries} />,
  gps: (p) => <GpsSection sources={p.enabled} windowRange={p.range} />,
  step: (p) => <StepResponseSection entries={p.entries} />,
  latency: (p) => <LatencySection entries={p.entries} />,
  spectrum: (p) => <FullSpectrumSection entries={p.entries} />,
  filterSim: (p) => <FilterSimulatorSection entries={p.entries} />,
  spectral: (p) => <SpectralSection entries={p.entries} />,
  settings: (p) => <TuneSettingsPanel entries={p.entries} />,
  diff: (p) => <DiffSummarySection entries={p.entries} />,
};

/** The active tab's section, inside its own plot sync scope. */
export function TabContent(props: Props) {
  return (
    <div className="tab-content">
      {/* Keyed by tab: each tab's plots sync among themselves, starting unzoomed. */}
      <PlotSyncScope key={props.tab}>{SECTIONS[props.tab](props)}</PlotSyncScope>
    </div>
  );
}
