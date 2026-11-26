import { AXIS_NAMES, BF_CLI_AXIS_HEADERS, BF_CLI_ENUMS, BF_CLI_GROUPS } from '../constants';

type Headers = Readonly<Record<string, string | undefined>>;

const AXES = AXIS_NAMES.map((n) => n.toLowerCase());

/** A header value as the CLI expects it: enum names instead of their numbers. */
function cliValue(name: string, raw: string): string {
  const names = BF_CLI_ENUMS[name];
  const idx = Number.parseInt(raw, 10);

  return names && String(idx) === raw.trim() && names[idx] ? names[idx] : raw.trim();
}

function splitList(raw: string | undefined): string[] {
  return raw == null ? [] : raw.split(',').map((v) => v.trim());
}

/** P, I and D from rollPID / pitchPID / yawPID. */
function pidLines(h: Headers): string[] {
  return AXES.flatMap((axis) => {
    const [p, i, d] = splitList(h[`${axis}PID`]);

    return [
      ['p', p],
      ['i', i],
      ['d', d],
    ].flatMap(([term, v]) => (v ? [`set ${term}_${axis} = ${v}`] : []));
  });
}

/** Per-axis lists such as d_max:40,46,0 → d_max_roll, d_max_pitch, d_max_yaw. */
function axisListLines(h: Headers): string[] {
  return BF_CLI_AXIS_HEADERS.flatMap(({ header, cli }) =>
    splitList(h[header]).flatMap((v, i) => (v && AXES[i] ? [`set ${cli(AXES[i])} = ${v}`] : [])),
  );
}

/** Dynamic lowpass ranges logged as "min,max". */
function dynRangeLines(h: Headers): string[] {
  return ['gyro_lpf1', 'dterm_lpf1'].flatMap((filter) => {
    const [min, max] = splitList(h[`${filter}_dyn_hz`]);

    return min && max ? [`set ${filter}_dyn_min_hz = ${min}`, `set ${filter}_dyn_max_hz = ${max}`] : [];
  });
}

/**
 * Betaflight CLI `set` commands that reproduce the tune logged in a blackbox
 * header: PIDs, feedforward, rates, filters and the PID controller settings.
 * Only settings present in the header are written; nothing is saved, so the
 * pilot can review before typing `save`.
 */
export function tuneCliCommands(headers: Headers, source: string): string {
  const groups: Array<[string, string[]]> = [
    ['PIDs, feedforward and rates', [...pidLines(headers), ...axisListLines(headers)]],
    ...BF_CLI_GROUPS.map(({ title, settings }): [string, string[]] => [
      title,
      [
        ...settings.flatMap((s) => (headers[s] != null ? [`set ${s} = ${cliValue(s, headers[s]!)}`] : [])),
        ...(title === 'Filters' ? dynRangeLines(headers) : []),
      ],
    ]),
  ];
  const rateType = headers.rates_type != null ? [`set rates_type = ${cliValue('rates_type', headers.rates_type)}`] : [];
  const body = groups
    .map(([title, lines]): [string, string[]] => [title, title.startsWith('PIDs') ? [...rateType, ...lines] : lines])
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => [`# ${title}`, ...lines].join('\n'));

  return [`# Tune from ${source}. Paste into the Betaflight CLI, check, then type: save`, ...body].join('\n\n') + '\n';
}
