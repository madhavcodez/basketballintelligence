'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Flame } from 'lucide-react';
import clsx from 'clsx';
import GlassCard from './GlassCard';
import MetricChip from './MetricChip';
import Badge from './Badge';
import PlayoffEmptyState from './PlayoffEmptyState';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayoffStatRow {
  readonly season: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
}

interface PlayoffAccoladesProps {
  readonly playerName: string;
  readonly awards: readonly { readonly awardType: string; readonly season: string; readonly team: string }[];
  readonly playoffStats: readonly PlayoffStatRow[] | null;
}

interface CareerAverages {
  readonly ppg: number;
  readonly rpg: number;
  readonly apg: number;
  readonly spg: number;
}

interface BestSeason {
  readonly season: string;
  readonly ppg: number;
}

// ── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

interface StatTotals {
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
}

function computeCareerAverages(
  stats: readonly PlayoffStatRow[],
): CareerAverages | null {
  if (stats.length === 0) return null;

  const initial: StatTotals = { points: 0, rebounds: 0, assists: 0, steals: 0 };
  const totals = stats.reduce<StatTotals>(
    (acc, s) => ({
      points: acc.points + Number(s.points ?? 0),
      rebounds: acc.rebounds + Number(s.rebounds ?? 0),
      assists: acc.assists + Number(s.assists ?? 0),
      steals: acc.steals + Number(s.steals ?? 0),
    }),
    initial,
  );

  const count = stats.length;
  return {
    ppg: totals.points / count,
    rpg: totals.rebounds / count,
    apg: totals.assists / count,
    spg: totals.steals / count,
  };
}

function findBestSeason(
  stats: readonly PlayoffStatRow[],
): BestSeason | null {
  if (stats.length === 0) return null;

  let best: BestSeason | null = null;
  for (const s of stats) {
    const ppg = Number(s.points ?? 0);
    const season = String(s.season ?? '');
    if (best === null || ppg > best.ppg) {
      best = { season, ppg };
    }
  }
  return best;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlayoffAccolades({
  playerName,
  awards,
  playoffStats,
}: PlayoffAccoladesProps) {
  // Derive playoff-specific awards
  const finalsMvpAwards = useMemo(
    () => awards.filter((a) => a.awardType === 'Finals MVP'),
    [awards],
  );

  const championshipCount = finalsMvpAwards.length;

  const careerAverages = useMemo(
    () => (playoffStats ? computeCareerAverages(playoffStats) : null),
    [playoffStats],
  );

  const bestSeason = useMemo(
    () => (playoffStats ? findBestSeason(playoffStats) : null),
    [playoffStats],
  );

  // Determine if there is any playoff data to show
  const hasPlayoffData =
    finalsMvpAwards.length > 0 ||
    (playoffStats !== null && playoffStats.length > 0);

  if (!hasPlayoffData) {
    return (
      <PlayoffEmptyState
        title="No Playoff Data"
        message={`Playoff statistics for ${playerName} are not yet available.`}
      />
    );
  }

  const metricChips: readonly { readonly label: string; readonly value: string; readonly highlight: boolean }[] =
    careerAverages
      ? [
          { label: 'PPG', value: careerAverages.ppg.toFixed(1), highlight: true },
          { label: 'RPG', value: careerAverages.rpg.toFixed(1), highlight: false },
          { label: 'APG', value: careerAverages.apg.toFixed(1), highlight: false },
          { label: 'SPG', value: careerAverages.spg.toFixed(1), highlight: false },
        ]
      : [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <GlassCard
        className={clsx(
          'p-6 sm:p-8',
          'border-accent-orange/20',
          'shadow-[0_0_20px_rgba(255,107,53,0.08)]',
        )}
        tintColor="#FF6B35"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent-orange/10 border border-accent-orange/20">
            <Trophy size={16} className="text-accent-orange" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1D1D1F] font-display">
            Playoff Resume
          </h2>
        </motion.div>

        {/* Championship + Finals MVP Badges */}
        {(championshipCount > 0) && (
          <motion.div variants={itemVariants} className="flex flex-wrap gap-2.5 mb-6">
            {championshipCount > 0 && (
              <Badge variant="warning" className="text-xs px-3 py-1">
                <Trophy size={12} className="mr-1.5" />
                {championshipCount > 1 ? `${championshipCount}x` : ''} Champion
              </Badge>
            )}
            {finalsMvpAwards.length > 0 && (
              <Badge variant="warning" className="text-xs px-3 py-1">
                <Star size={12} className="mr-1.5" />
                {finalsMvpAwards.length > 1
                  ? `${finalsMvpAwards.length}x `
                  : ''}
                Finals MVP
              </Badge>
            )}
          </motion.div>
        )}

        {/* Playoff Career Averages */}
        {careerAverages && (
          <div className="mb-5">
            <motion.p
              variants={itemVariants}
              className="text-[10px] uppercase tracking-wider text-[#86868B] font-medium mb-3"
            >
              Playoff Career Averages
            </motion.p>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {metricChips.map((chip) => (
                <motion.div key={chip.label} variants={itemVariants}>
                  <GlassCard className="flex items-center justify-center p-3">
                    <MetricChip
                      label={chip.label}
                      value={chip.value}
                      highlight={chip.highlight}
                      size="lg"
                    />
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Best Playoff Season */}
        {bestSeason && bestSeason.season && (
          <motion.div
            variants={itemVariants}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-accent-orange/[0.06] border border-accent-orange/15',
            )}
          >
            <Flame size={14} className="text-accent-orange shrink-0" />
            <p className="text-xs text-[#6E6E73]">
              <span className="font-semibold text-[#1D1D1F]">Best Playoff Season:</span>{' '}
              {bestSeason.season}{' '}
              <span className="text-accent-orange font-bold">
                {bestSeason.ppg.toFixed(1)} PPG
              </span>
            </p>
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}
