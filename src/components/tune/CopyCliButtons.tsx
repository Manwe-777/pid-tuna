import { useCopyText } from '../../hooks/useCopyText';
import { shortName } from '../../logs/shortName';
import { tuneCliCommands } from '../../tune/tuneCliCommands';
import type { LogEntry } from '../../types';

function label(copied: boolean, failed: boolean, name: string | null): string {
  if (copied) return 'Copied';
  if (failed) return 'Copy failed';

  return name ? `Copy ${name} as CLI` : 'Copy as CLI';
}

/** One button per log that copies its tune as Betaflight CLI commands. */
export function CopyCliButtons({ entries }: { entries: LogEntry[] }) {
  const { copy, copied, failed } = useCopyText();
  const multi = entries.length > 1;

  return (
    <div className="controls mb-2">
      {entries.map(({ slot, log }) => (
        <button
          key={slot.id}
          type="button"
          title="Betaflight CLI set commands for this log's PIDs, rates and filters; review, then type save"
          onClick={() =>
            copy(slot.id, tuneCliCommands(log.setup.rawHeaders, `${log.fileName} (${log.setup.firmwareVersion})`))
          }
        >
          {label(copied(slot.id), failed(slot.id), multi ? shortName(slot) : null)}
        </button>
      ))}
    </div>
  );
}
