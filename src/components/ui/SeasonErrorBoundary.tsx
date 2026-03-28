'use client';

import { Component, type ReactNode } from 'react';
import GlassCard from './GlassCard';
import { useSeasonType } from '@/lib/season-context';
import { AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

// ─── Recovery Buttons (functional, uses hooks) ──────────────────────────────

function RecoveryActions({ onReset }: { readonly onReset: () => void }) {
  const { setSeasonType } = useSeasonType();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setSeasonType('regular');
          onReset();
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#4DA6FF]/20 text-[#4DA6FF] text-sm font-semibold border border-[#4DA6FF]/30 hover:bg-[#4DA6FF]/30 transition-colors"
      >
        <BarChart3 size={14} />
        Switch to Regular Season
      </button>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] text-white/60 text-sm font-semibold border border-white/[0.12] hover:bg-white/[0.14] transition-colors"
      >
        <RefreshCw size={14} />
        Try Again
      </button>
    </div>
  );
}

// ─── Error Boundary (class component) ───────────────────────────────────────

export default class SeasonErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <GlassCard className="p-8 sm:p-10" tintColor="#FF6B35">
          <div className="flex flex-col items-center text-center gap-5">
            {/* Icon */}
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20">
              <AlertTriangle size={28} className="text-[#FF6B35]" />
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] font-display">
                Something went wrong loading playoff data
              </h3>
              <p className="text-sm text-[#86868B] max-w-sm leading-relaxed">
                There was an error displaying this section. You can switch back
                to regular season data or try loading again.
              </p>
            </div>

            {/* Actions — rendered as a functional component so it can use hooks */}
            <RecoveryActions onReset={this.handleReset} />
          </div>
        </GlassCard>
      );
    }

    return this.props.children;
  }
}
