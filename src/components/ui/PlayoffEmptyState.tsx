import { Trophy } from 'lucide-react';
import GlassCard from './GlassCard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayoffEmptyStateProps {
  readonly title?: string;
  readonly message?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlayoffEmptyState({
  title = 'Playoff Data Coming Soon',
  message = 'Playoff statistics are being collected and will appear here shortly.',
}: PlayoffEmptyStateProps) {
  return (
    <GlassCard className="p-8 sm:p-10" tintColor="#FF6B35">
      <div className="flex flex-col items-center text-center gap-5">
        {/* Trophy icon — static indicator */}
        <div
          className="flex items-center justify-center h-20 w-20 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20"
        >
          <Trophy size={36} className="text-[#FF6B35]/50" />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-semibold text-[#1D1D1F] font-display">
            {title}
          </h3>
          <p className="text-sm text-[#86868B] max-w-xs leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
