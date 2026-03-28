import { EFFICIENCY_STOPS } from '@/lib/shot-constants';
import { colors } from '@/lib/design-tokens';

// ── Gradient stops mapped to CSS ──────────────────────────────────────────────

const GRADIENT_STOPS = [
  { offset: '0%', color: EFFICIENCY_STOPS.deepCold },
  { offset: '16.7%', color: EFFICIENCY_STOPS.cold },
  { offset: '33.3%', color: EFFICIENCY_STOPS.cool },
  { offset: '50%', color: EFFICIENCY_STOPS.neutral },
  { offset: '66.7%', color: EFFICIENCY_STOPS.warm },
  { offset: '83.3%', color: EFFICIENCY_STOPS.hot },
  { offset: '100%', color: EFFICIENCY_STOPS.fire },
] as const;

const LABELS = ['-15%', '-10%', '-5%', 'Avg', '+5%', '+10%', '+15%'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface CourtLegendProps {
  readonly className?: string;
}

export default function CourtLegend({ className }: CourtLegendProps) {
  const gradientString = GRADIENT_STOPS.map(
    (s) => `${s.color} ${s.offset}`,
  ).join(', ');

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: 280,
      }}
    >
      {/* Title */}
      <span
        style={{
          color: colors.chromeDim,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        FG% vs League Avg
      </span>

      {/* Gradient bar */}
      <div
        style={{
          width: '100%',
          height: 12,
          borderRadius: 6,
          background: `linear-gradient(to right, ${gradientString})`,
          border: `1px solid ${colors.glassBorder}`,
        }}
      />

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        {LABELS.map((label) => (
          <span
            key={label}
            style={{
              color: colors.chromeDim,
              fontSize: 10,
              lineHeight: '14px',
              fontWeight: 500,
              textAlign: 'center',
              minWidth: 28,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
