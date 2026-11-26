import { useEffect, useMemo, useState } from 'react';
import { DASH_PATTERNS, TABS } from '../../constants';
import { sliceLog } from '../../logs/sliceLog';
import type { LogEntry, LogSlot, ParsedLog, TabId, TimeRangeSec } from '../../types';
import { tabHasData } from '../../utils/tabHasData';
import { TimeRangeControl } from './TimeRangeControl';
import { TuneSettingsPanel } from '../tune/TuneSettingsPanel';
import { BalanceSection } from '../balance/BalanceSection';
import { BatterySection } from '../battery/BatterySection';
import { DiffSummarySection } from '../diff/DiffSummarySection';
import { FilterSimulatorSection } from '../filters/FilterSimulatorSection';
import { GpsSection } from '../gps/GpsSection';
import { LatencySection } from '../latency/LatencySection';
import { MotorsSection } from '../motors/MotorsSection';
import { PidTermsSection } from '../pidTerms/PidTermsSection';
import { SaturationSection } from '../saturation/SaturationSection';
import { ScorecardSection } from '../scorecard/ScorecardSection';
import { SpectralSection } from '../spectral/SpectralSection';
import { FullSpectrumSection } from '../spectrum/FullSpectrumSection';
import { StepResponseSection } from '../step/StepResponseSection';
import { FilteringSection } from '../tracking/FilteringSection';
import { TrackingSection } from '../tracking/TrackingSection';
import { TabBar } from './TabBar';

export function Analyses({ enabled }: { enabled: Array<{ slot: LogSlot; log: ParsedLog }> }) {
  const duration = useMemo(
    () => Math.max(...enabled.map(({ log }) => log.time[log.time.length - 1] ?? 0), 0),
    [enabled],
  );
  const primaryId = enabled[0]?.slot.id ?? null;

  const [range, setRange] = useState<TimeRangeSec>(() => ({
    start: duration > 12 ? 5 : 0,
    end: duration > 12 ? duration - 5 : duration,
  }));

  useEffect(() => {
    setRange({
      start: duration > 12 ? 5 : 0,
      end: duration > 12 ? duration - 5 : duration,
    });
  }, [duration, primaryId]);

  const entries = useMemo<LogEntry[]>(
    () =>
      enabled.map(({ slot, log }) => ({
        slot,
        log: sliceLog(log, range),
        dash: [...(DASH_PATTERNS[slot.dashIndex % DASH_PATTERNS.length] ?? [])],
      })),
    [enabled, range],
  );

  const primary = entries[0]!;
  const empty = primary.log.time.length === 0;

  const [tab, setTab] = useState<TabId>('scorecard');

  const disabledTabs = useMemo(() => {
    const out = new Set<TabId>();
    for (const { id } of TABS) {
      if (!tabHasData(id, entries)) out.add(id);
    }
    return out;
  }, [entries]);

  // If the active tab loses its data (e.g. user switched to a log without GPS),
  // bounce back to the scorecard rather than rendering an empty section.
  useEffect(() => {
    if (disabledTabs.has(tab)) setTab('scorecard');
  }, [disabledTabs, tab]);

  return (
    <>
      <section className="window-controls">
        <TimeRangeControl max={duration} value={range} onChange={setRange} />
      </section>
      <TabBar active={tab} onChange={setTab} disabled={disabledTabs} />
      {empty ? (
        <p className="muted">Selected window contains no samples. Widen the range above.</p>
      ) : (
        <div className="tab-content">
          {tab === 'scorecard' && <ScorecardSection entries={entries} onJump={setTab} />}
          {tab === 'tracking' && <TrackingSection entries={entries} />}
          {tab === 'filtering' && <FilteringSection entries={entries} />}
          {tab === 'pid' && <PidTermsSection entries={entries} />}
          {tab === 'saturation' && <SaturationSection entries={entries} />}
          {tab === 'motors' && <MotorsSection entries={entries} />}
          {tab === 'balance' && <BalanceSection entries={entries} />}
          {tab === 'battery' && <BatterySection entries={entries} />}
          {tab === 'gps' && <GpsSection sources={enabled} windowRange={range} />}
          {tab === 'step' && <StepResponseSection entries={entries} />}
          {tab === 'latency' && <LatencySection entries={entries} />}
          {tab === 'spectrum' && <FullSpectrumSection entries={entries} />}
          {tab === 'filterSim' && <FilterSimulatorSection entries={entries} />}
          {tab === 'spectral' && <SpectralSection entries={entries} />}
          {tab === 'settings' && <TuneSettingsPanel entries={entries} />}
          {tab === 'diff' && <DiffSummarySection entries={entries} />}
        </div>
      )}
    </>
  );
}
