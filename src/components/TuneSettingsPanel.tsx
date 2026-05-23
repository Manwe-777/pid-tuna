import { Fragment, useMemo } from 'react';
import { AXIS_COLORS, AXIS_NAMES } from '../axes';
import type { LogEntry } from '../logs';
import { shortName } from '../logs';
import { buildTuneView } from '../tuneView';

export interface TuneSettingsPanelProps {
  entries: LogEntry[];
}

// Common Betaflight filter type IDs.
const LPF_TYPE: Record<string, string> = {
  '0': 'PT1',
  '1': 'BIQUAD',
  '2': 'PT2',
  '3': 'PT3',
};

const NOTCH_TYPE: Record<string, string> = {
  '0': 'BIQUAD',
  '1': 'PT1',
};


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
          <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem', fontWeight: 400 }}>
            Comparing {views.length} logs · differences vs {shortName(primary.slot)} highlighted
          </span>
        )}
      </h2>

      <div className="tune-row">
      {/* PIDF table */}
      <div className="tune-block">
        <h3>PIDF</h3>
        {view.hasPid ? (
          <table className="tune-table">
            <thead>
              <tr>
                <th></th>
                <th>P</th>
                <th>I</th>
                <th>D</th>
                <th>D Max</th>
                <th>F</th>
              </tr>
            </thead>
            <tbody>
              {AXIS_NAMES.map((name, i) => {
                const primaryRow = primary.view.pidByAxis[i]!;
                const primaryCols = [primaryRow.p, primaryRow.i, primaryRow.d, primaryRow.dMax, primaryRow.f];
                return (
                  <Fragment key={name}>
                    {views.map(({ slot, view }, vi) => {
                      const row = view.pidByAxis[i]!;
                      const cols = [row.p, row.i, row.d, row.dMax, row.f];
                      const isPrimary = vi === 0;
                      return (
                        <tr key={slot.id} className={isPrimary ? undefined : 'tune-cmp__row-b'}>
                          {vi === 0 && (
                            <th rowSpan={views.length}>
                              <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                                {name.toUpperCase()}
                              </span>
                            </th>
                          )}
                          {multi && <td className="tune-cmp__label">{shortName(slot)}</td>}
                          {cols.map((v, c) => (
                            <td
                              key={c}
                              className={!isPrimary && v !== primaryCols[c] ? 'tune-cmp__diff' : undefined}
                            >
                              {formatNum(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      {/* Rates table */}
      <div className="tune-block tune-block--no-divider">
        <h3>Rates</h3>
        {view.hasRates ? (
          <table className="tune-table">
            <thead>
              <tr>
                <th></th>
                <th>RC rate</th>
                <th>Expo</th>
                <th>Super</th>
              </tr>
            </thead>
            <tbody>
              {AXIS_NAMES.map((name, i) => {
                const primaryCols = [
                  primary.view.rcRates[i],
                  primary.view.rcExpo[i],
                  primary.view.superRates[i],
                ];
                return (
                  <Fragment key={name}>
                    {views.map(({ slot, view }, vi) => {
                      const cols = [view.rcRates[i], view.rcExpo[i], view.superRates[i]];
                      const isPrimary = vi === 0;
                      return (
                        <tr key={slot.id} className={isPrimary ? undefined : 'tune-cmp__row-b'}>
                          {vi === 0 && (
                            <th rowSpan={views.length}>
                              <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                                {name.toUpperCase()}
                              </span>
                            </th>
                          )}
                          {multi && <td className="tune-cmp__label">{shortName(slot)}</td>}
                          {cols.map((v, c) => (
                            <td
                              key={c}
                              className={!isPrimary && v !== primaryCols[c] ? 'tune-cmp__diff' : undefined}
                            >
                              {formatNum(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      </div>{/* /tune-row */}

      {/* Filter chain */}
      <div className="tune-block">
        <h3>Gyro filters</h3>
        <ul className="tune-list">
          <FilterLine label="LPF 1" hz={view.gyroLpf1Hz} type={lpfType(view.gyroLpf1Type)} dyn={view.gyroDynRange} />
          <FilterLine label="LPF 2" hz={view.gyroLpf2Hz} type={lpfType(view.gyroLpf2Type)} />
          <FilterLine label="Notch 1" hz={view.gyroNotch1Hz} cutoff={view.gyroNotch1Cutoff} />
          <FilterLine label="Notch 2" hz={view.gyroNotch2Hz} cutoff={view.gyroNotch2Cutoff} />
        </ul>
      </div>

      <div className="tune-block">
        <h3>D-term filters</h3>
        <ul className="tune-list">
          <FilterLine label="LPF 1" hz={view.dtermLpf1Hz} type={lpfType(view.dtermLpf1Type)} dyn={view.dtermDynRange} />
          <FilterLine label="LPF 2" hz={view.dtermLpf2Hz} type={lpfType(view.dtermLpf2Type)} />
          <FilterLine label="Notch" hz={view.dtermNotchHz} cutoff={view.dtermNotchCutoff} />
        </ul>
      </div>

      <div className="tune-block">
        <h3>RPM filter</h3>
        {view.rpmHarmonics != null ? (
          <ul className="tune-list">
            <li>
              <span className="tune-list__k">Harmonics</span>
              <span className="tune-list__v">{view.rpmHarmonics}</span>
            </li>
            {view.rpmMinHz != null && (
              <li>
                <span className="tune-list__k">Min freq</span>
                <span className="tune-list__v">{view.rpmMinHz} Hz</span>
              </li>
            )}
            {view.rpmQ != null && (
              <li>
                <span className="tune-list__k">Q</span>
                <span className="tune-list__v">{view.rpmQ}</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      <div className="tune-block">
        <h3>Dynamic notch</h3>
        {view.dynNotchCount != null || view.dynNotchMin != null ? (
          <ul className="tune-list">
            {view.dynNotchCount != null && (
              <li><span className="tune-list__k">Count</span><span className="tune-list__v">{view.dynNotchCount}</span></li>
            )}
            {view.dynNotchMin != null && (
              <li><span className="tune-list__k">Min freq</span><span className="tune-list__v">{view.dynNotchMin} Hz</span></li>
            )}
            {view.dynNotchMax != null && (
              <li><span className="tune-list__k">Max freq</span><span className="tune-list__v">{view.dynNotchMax} Hz</span></li>
            )}
            {view.dynNotchQ != null && (
              <li><span className="tune-list__k">Q</span><span className="tune-list__v">{view.dynNotchQ}</span></li>
            )}
          </ul>
        ) : (
          <p className="muted">Not in headers.</p>
        )}
      </div>

      <div className="tune-block">
        <h3>Hardware / firmware</h3>
        <ul className="tune-list">
          <li><span className="tune-list__k">Firmware</span><span className="tune-list__v">{log.setup.firmwareKind} {log.setup.firmwareVersion}</span></li>
          {log.setup.boardInfo && (
            <li><span className="tune-list__k">Board</span><span className="tune-list__v">{log.setup.boardInfo}</span></li>
          )}
          {log.setup.pwmProtocol && (
            <li><span className="tune-list__k">PWM</span><span className="tune-list__v">{log.setup.pwmProtocol}</span></li>
          )}
          {log.setup.debugMode && (
            <li><span className="tune-list__k">Debug mode</span><span className="tune-list__v">{log.setup.debugMode}</span></li>
          )}
          {log.setup.features.length > 0 && (
            <li><span className="tune-list__k">Features</span><span className="tune-list__v">{log.setup.features.join(', ')}</span></li>
          )}
          <li><span className="tune-list__k">Loop / sample</span><span className="tune-list__v">{log.setup.looptimeUs} µs / {log.setup.sampleRateHz.toLocaleString()} Hz</span></li>
        </ul>
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

function FilterLine({
  label,
  hz,
  type,
  cutoff,
  dyn,
}: {
  label: string;
  hz?: number;
  type?: string;
  cutoff?: number;
  dyn?: { min: number; max: number };
}) {
  if (hz == null || hz === 0) {
    return (
      <li>
        <span className="tune-list__k">{label}</span>
        <span className="tune-list__v muted">off</span>
      </li>
    );
  }
  let value = `${hz} Hz`;
  if (cutoff != null && cutoff !== 0) value += ` (cutoff ${cutoff} Hz)`;
  if (dyn && dyn.min !== dyn.max && dyn.min > 0) value = `${dyn.min}–${dyn.max} Hz (dynamic)`;
  if (type) value += ` · ${type}`;
  return (
    <li>
      <span className="tune-list__k">{label}</span>
      <span className="tune-list__v">{value}</span>
    </li>
  );
}

function lpfType(id?: number): string | undefined {
  if (id == null) return undefined;
  return LPF_TYPE[String(id)] ?? `type ${id}`;
}

function formatNum(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toString();
}

// TuneView + buildTuneView now live in ../tuneView (shared with sidebar).
