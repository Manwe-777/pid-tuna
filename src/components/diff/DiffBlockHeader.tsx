import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogSlot, ParsedLog } from '../../types';
import { formatLogStartLabel } from '../../utils/formatLogStartLabel';

export function DiffBlockHeader({ slot, log, prev }: { slot: LogSlot; log: ParsedLog | null; prev: LogSlot | null }) {
  const stamp = log ? formatLogStartLabel(log) : null;
  return (
    <h4 className="diff-log__head">
      <span className="diff-log__chip" style={{ background: colorFor(slot) }} />
      <span className="diff-log__name">{shortName(slot)}</span>
      {stamp && <span className="diff-log__stamp">{stamp}</span>}
      <span className="diff-log__vs">{prev ? `vs ${shortName(prev)}` : 'baseline'}</span>
    </h4>
  );
}
