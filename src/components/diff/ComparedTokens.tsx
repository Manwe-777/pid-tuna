import { Fragment } from 'react';
import { tokenClass } from '../../utils/tokenClass';

/** Renders a comma-separated value, coloring each numeric token vs the prior value's same position. */
export function ComparedTokens({
  value,
  prev,
  dim,
}: {
  value: string | undefined;
  prev: string | undefined;
  dim: boolean;
}) {
  if (value === undefined || value === '') return <span className="muted">—</span>;
  if (dim) return <span>{value}</span>;
  const vTokens = value.split(',');
  const pTokens = prev?.split(',') ?? [];
  return (
    <span className="diff-tokens">
      {vTokens.map((tok, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="diff-tok-sep">,</span>}
          <span className={tokenClass(tok, pTokens[i])}>{tok}</span>
        </Fragment>
      ))}
    </span>
  );
}
