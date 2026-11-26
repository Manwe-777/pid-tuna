import type { ReactNode } from 'react';

/** A titled group of controls inside a `control-panel`. */
export function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="control-group" role="group" aria-label={title}>
      <span className="control-group__title">{title}</span>
      <div className="controls">{children}</div>
    </div>
  );
}
