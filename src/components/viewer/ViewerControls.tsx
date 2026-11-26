import { AXIS_COLORS, AXIS_NAMES, MOTOR_COLORS, VIEWER_SIGNAL_GROUPS, VIEWER_SIGNALS } from '../../constants';
import type { useViewerSelection } from '../../hooks/useViewerSelection';
import type { LogEntry } from '../../types';
import { matchingPreset } from '../../viewer/matchingPreset';
import { presetSignals } from '../../viewer/presetSignals';
import { viewerSignalAvailable } from '../../viewer/viewerSignalAvailable';
import { ControlGroup } from '../common/ControlGroup';
import { ViewerChip } from './ViewerChip';
import { ViewerPresetButtons } from './ViewerPresetButtons';

const DEFS = new Map(VIEWER_SIGNALS.map((d) => [d.key, d]));

/** Presets, signal chips, and the axes and motors to show. */
export function ViewerControls({
  entries,
  viewer,
  motorCount,
}: {
  entries: LogEntry[];
  viewer: ReturnType<typeof useViewerSelection>;
  motorCount: number;
}) {
  const { selection } = viewer;
  const showMotors = motorCount > 1 && (selection.signals.has('motors') || selection.signals.has('eRpm'));

  return (
    <div className="control-panel">
      <ControlGroup title="Preset">
        <ViewerPresetButtons
          active={matchingPreset(selection.signals, entries)}
          onPick={(p) => viewer.setSignals(presetSignals(p, entries))}
        />
      </ControlGroup>
      {VIEWER_SIGNAL_GROUPS.map((group) => (
        <ControlGroup key={group.title} title={group.title}>
          {group.keys.map((key) => {
            const def = DEFS.get(key)!;
            const present = viewerSignalAvailable(def, entries);

            return (
              <ViewerChip
                key={key}
                label={def.label}
                color={def.color || undefined /* gyro and motors take per-axis or per-motor colours */}
                checked={present && selection.signals.has(key)}
                disabled={!present}
                tip={present ? undefined : 'Not in these logs'}
                onToggle={() => viewer.toggleSignal(key)}
              />
            );
          })}
        </ControlGroup>
      ))}
      <ControlGroup title="Axes">
        {AXIS_NAMES.map((name, i) => (
          <ViewerChip
            key={name}
            label={name}
            color={AXIS_COLORS[i]}
            checked={selection.axes.has(i)}
            onToggle={() => viewer.toggleAxis(i)}
          />
        ))}
      </ControlGroup>
      {showMotors && (
        <ControlGroup title="Motors">
          {Array.from({ length: motorCount }, (_, i) => (
            <ViewerChip
              key={i}
              label={`M${i + 1}`}
              color={MOTOR_COLORS[i % MOTOR_COLORS.length]}
              checked={!selection.hiddenMotors.has(i)}
              onToggle={() => viewer.toggleMotor(i)}
            />
          ))}
        </ControlGroup>
      )}
    </div>
  );
}
