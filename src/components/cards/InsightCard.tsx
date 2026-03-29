'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Target, Lightbulb, Swords, Trophy } from 'lucide-react';
import type { Insight } from '@/lib/insights-engine';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

// ── Icon map ────────────────────────────────────────────────────────────────

const ICON_MAP: Readonly<Record<string, React.ComponentType<{ size?: number; className?: string }>>> = {
  TrendingUp,
  Target,
  Lightbulb,
  Swords,
  Trophy,
};

const SEVERITY_STYLES: Readonly<Record<string, string>> = {
  info: 'border-l-[#4DA6FF] bg-[#4DA6FF]/[0.04]',
  highlight: 'border-l-[#FF6B35] bg-[#FF6B35]/[0.04]',
  alert: 'border-l-[#F87171] bg-[#F87171]/[0.04]',
};

const SEVERITY_ICON_CLASSES: Readonly<Record<string, string>> = {
  info: 'text-[#4DA6FF]',
  highlight: 'text-[#FF6B35]',
  alert: 'text-[#F87171]',
};

// ── Animation ───────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeIn = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

// ── Component ───────────────────────────────────────────────────────────────

interface InsightCardProps {
  readonly insights: readonly Insight[];
}

export default function InsightCard({ insights }: InsightCardProps) {
  if (insights.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Insights"
        eyebrow="Auto-Generated"
        action={<Lightbulb size={14} className="text-[#86868B]" />}
        className="mb-3"
      />
      <motion.div
        className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {insights.map((insight) => {
          const Icon = ICON_MAP[insight.icon] ?? Lightbulb;
          const iconClass = SEVERITY_ICON_CLASSES[insight.severity] ?? 'text-[#86868B]';

          return (
            <motion.div key={insight.id} variants={fadeIn} className="shrink-0">
              <GlassCard className={`w-[220px] p-3 border-l-[3px] ${SEVERITY_STYLES[insight.severity] ?? ''}`}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    <Icon size={14} className={iconClass} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1D1D1F] leading-tight truncate">
                      {insight.title}
                    </p>
                    <p className="text-[10px] text-[#86868B] leading-snug mt-1 line-clamp-3">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
