import { DASH_PATTERNS, LOG_COLORS } from '../../constants';

export function DashSwatch({ dashIndex }: { dashIndex: number }) {
  const pattern = DASH_PATTERNS[dashIndex % DASH_PATTERNS.length] ?? [];
  const dashAttr = pattern.length > 0 ? pattern.join(' ') : 'none';
  const color = LOG_COLORS[dashIndex % LOG_COLORS.length]!;
  return (
    <svg width="22" height="6" className="log-card__dash" aria-hidden>
      <line x1="1" y1="3" x2="21" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashAttr} />
    </svg>
  );
}
