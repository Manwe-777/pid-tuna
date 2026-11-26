import { useMemo } from 'react';

import { shortName } from '../../logs/shortName';
import { bfLpfTypeName } from '../../tune/bfLpfTypeName';
import { buildTuneView } from '../../tune/buildTuneView';
import { dynNotchItems } from '../../tune/dynNotchItems';
import { hardwareItems } from '../../tune/hardwareItems';
import { rpmFilterItems } from '../../tune/rpmFilterItems';
import type { LogEntry, TuneView } from '../../types';
import { CopyCliButtons } from './CopyCliButtons';
import { FilterLine } from './FilterLine';
import { TuneCompareTable } from './TuneCompareTable';
import { TuneValueList } from './TuneValueList';

const pidColumns = (view: TuneView, axis: number) => {
  const row = view.pidByAxis[axis]!;

  return [row.p, row.i, row.d, row.dMax, row.f];
};

const rateColumns = (view: TuneView, axis: number) => [view.rcRates[axis], view.rcExpo[axis], view.superRates[axis]];

interface TuneSettingsPanelProps {
  entries: LogEntry[];
}

export function TuneSettingsPanel({ entries }: TuneSettingsPanelProps) {
  const views = useMemo(() => entries.map(({ slot, log }) => ({ slot, view: buildTuneView(log) })), [entries]);
  const primary = views[0]!;
  const view = primary.view;
  const multi = views.length > 1;
  const log = entries[0]!.log;

  return (
    <section className="tune-panel">
      <h2>
        Tune settings
        {multi && (
          <span className="muted ml-3 text-[0.85rem] font-normal">
            Comparing {views.length} logs · differences vs {shortName(primary.slot)} highlighted
          </span>
        )}
      </h2>

      <CopyCliButtons entries={entries} />

      <div className="tune-row">
        {/* PIDF table */}
        <div className="tune-block">
          <h3>PIDF</h3>
          {view.hasPid ? (
            <TuneCompareTable views={views} headers={['P', 'I', 'D', 'D Max', 'F']} columns={pidColumns} />
          ) : (
            <p className="muted">Not in headers.</p>
          )}
        </div>

        {/* Rates table */}
        <div className="tune-block tune-block--no-divider">
          <h3>Rates</h3>
          {view.hasRates ? (
            <TuneCompareTable views={views} headers={['RC rate', 'Expo', 'Super']} columns={rateColumns} />
          ) : (
            <p className="muted">Not in headers.</p>
          )}
        </div>
      </div>
      {/* /tune-row */}

      {/* Filter chain */}
      <div className="tune-block">
        <h3>Gyro filters</h3>
        <ul className="tune-list">
          <FilterLine
            label="LPF 1"
            hz={view.gyroLpf1Hz}
            type={bfLpfTypeName(view.gyroLpf1Type)}
            dyn={view.gyroDynRange}
          />
          <FilterLine label="LPF 2" hz={view.gyroLpf2Hz} type={bfLpfTypeName(view.gyroLpf2Type)} />
          <FilterLine label="Notch 1" hz={view.gyroNotch1Hz} cutoff={view.gyroNotch1Cutoff} />
          <FilterLine label="Notch 2" hz={view.gyroNotch2Hz} cutoff={view.gyroNotch2Cutoff} />
        </ul>
      </div>

      <div className="tune-block">
        <h3>D-term filters</h3>
        <ul className="tune-list">
          <FilterLine
            label="LPF 1"
            hz={view.dtermLpf1Hz}
            type={bfLpfTypeName(view.dtermLpf1Type)}
            dyn={view.dtermDynRange}
          />
          <FilterLine label="LPF 2" hz={view.dtermLpf2Hz} type={bfLpfTypeName(view.dtermLpf2Type)} />
          <FilterLine label="Notch" hz={view.dtermNotchHz} cutoff={view.dtermNotchCutoff} />
        </ul>
      </div>

      <div className="tune-block">
        <h3>RPM filter</h3>
        {view.rpmHarmonics != null ? (
          <TuneValueList items={rpmFilterItems(view)} />
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      <div className="tune-block">
        <h3>Dynamic notch</h3>
        {view.dynNotchCount != null || view.dynNotchMin != null ? (
          <TuneValueList items={dynNotchItems(view)} />
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      <div className="tune-block">
        <h3>Hardware / firmware</h3>
        <TuneValueList items={hardwareItems(log.setup)} />
      </div>

      <details className="tune-raw">
        <summary>All headers ({Object.keys(log.setup.rawHeaders).length})</summary>
        <table className="tune-table tune-raw__table">
          <tbody>
            {Object.entries(log.setup.rawHeaders)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
