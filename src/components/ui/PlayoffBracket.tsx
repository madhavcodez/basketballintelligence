'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Trophy } from 'lucide-react';
import GlassCard from './GlassCard';

// ── Types ────────────────────────────────────────────────────────────────────

interface BracketMatchup {
  readonly team1: string;
  readonly team2: string;
  readonly seed1: number;
  readonly seed2: number;
  readonly score1: number;
  readonly score2: number;
  readonly winner: string | null; // null = in progress
}

interface BracketRound {
  readonly name: string;
  readonly matchups: readonly BracketMatchup[];
}

interface PlayoffBracketProps {
  readonly rounds?: readonly BracketRound[];
  readonly conference?: 'East' | 'West' | 'both';
}

// ── Mock data (2024 NBA Playoffs) ────────────────────────────────────────────

const MOCK_EAST_ROUNDS: readonly BracketRound[] = [
  {
    name: 'Round 1',
    matchups: [
      { team1: 'BOS', team2: 'MIA', seed1: 1, seed2: 8, score1: 4, score2: 1, winner: 'BOS' },
      { team1: 'CLE', team2: 'ORL', seed1: 4, seed2: 5, score1: 4, score2: 3, winner: 'CLE' },
      { team1: 'NYK', team2: 'PHI', seed1: 2, seed2: 7, score1: 4, score2: 2, winner: 'NYK' },
      { team1: 'MIL', team2: 'IND', seed1: 3, seed2: 6, score1: 2, score2: 4, winner: 'IND' },
    ],
  },
  {
    name: 'Round 2',
    matchups: [
      { team1: 'BOS', team2: 'CLE', seed1: 1, seed2: 4, score1: 4, score2: 1, winner: 'BOS' },
      { team1: 'NYK', team2: 'IND', seed1: 2, seed2: 6, score1: 3, score2: 4, winner: 'IND' },
    ],
  },
  {
    name: 'Conf Finals',
    matchups: [
      { team1: 'BOS', team2: 'IND', seed1: 1, seed2: 6, score1: 4, score2: 0, winner: 'BOS' },
    ],
  },
];

const MOCK_WEST_ROUNDS: readonly BracketRound[] = [
  {
    name: 'Round 1',
    matchups: [
      { team1: 'OKC', team2: 'NOP', seed1: 1, seed2: 8, score1: 4, score2: 0, winner: 'OKC' },
      { team1: 'LAC', team2: 'DAL', seed1: 4, seed2: 5, score1: 2, score2: 4, winner: 'DAL' },
      { team1: 'MIN', team2: 'PHX', seed1: 2, seed2: 7, score1: 4, score2: 0, winner: 'MIN' },
      { team1: 'DEN', team2: 'LAL', seed1: 3, seed2: 6, score1: 1, score2: 4, winner: 'LAL' },
    ],
  },
  {
    name: 'Round 2',
    matchups: [
      { team1: 'OKC', team2: 'DAL', seed1: 1, seed2: 5, score1: 2, score2: 4, winner: 'DAL' },
      { team1: 'MIN', team2: 'DEN', seed1: 2, seed2: 3, score1: 4, score2: 3, winner: 'MIN' },
    ],
  },
  {
    name: 'Conf Finals',
    matchups: [
      { team1: 'MIN', team2: 'DAL', seed1: 2, seed2: 5, score1: 1, score2: 4, winner: 'DAL' },
    ],
  },
];

const MOCK_FINALS: readonly BracketRound[] = [
  {
    name: 'Finals',
    matchups: [
      { team1: 'BOS', team2: 'DAL', seed1: 1, seed2: 5, score1: 4, score2: 1, winner: 'BOS' },
    ],
  },
];

// ── Animation ────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

// ── Matchup Card ─────────────────────────────────────────────────────────────

interface MatchupCardProps {
  readonly matchup: BracketMatchup;
  readonly compact?: boolean;
}

function MatchupCard({ matchup, compact = false }: MatchupCardProps) {
  const { team1, team2, seed1, seed2, score1, score2, winner } = matchup;
  const isFinished = winner !== null;
  const team1Won = winner === team1;
  const team2Won = winner === team2;

  return (
    <motion.div variants={cardVariants}>
      <GlassCard
        hoverable
        tintColor="#FF6B35"
        className={clsx(
          'group relative',
          compact ? 'w-[140px] p-2.5' : 'w-[160px] p-3',
        )}
      >
        {/* Warm glow on hover */}
        <div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_20px_rgba(255,107,53,0.12)]" />

        {/* Team 1 */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[#86868B] font-mono w-3 text-right shrink-0">
              {seed1}
            </span>
            <span
              className={clsx(
                'text-xs font-bold truncate transition-colors',
                isFinished && team1Won && 'text-white',
                isFinished && !team1Won && 'text-white/30',
                !isFinished && 'text-[#1D1D1F]',
              )}
            >
              {team1}
            </span>
            {team1Won && (
              <Trophy size={10} className="text-accent-gold shrink-0" />
            )}
          </div>
          <span
            className={clsx(
              'text-xs font-mono font-bold shrink-0',
              isFinished && team1Won && 'text-accent-orange',
              isFinished && !team1Won && 'text-white/30',
              !isFinished && 'text-[#6E6E73]',
            )}
          >
            {score1}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-black/[0.06] my-1" />

        {/* Team 2 */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[#86868B] font-mono w-3 text-right shrink-0">
              {seed2}
            </span>
            <span
              className={clsx(
                'text-xs font-bold truncate transition-colors',
                isFinished && team2Won && 'text-white',
                isFinished && !team2Won && 'text-white/30',
                !isFinished && 'text-[#1D1D1F]',
              )}
            >
              {team2}
            </span>
            {team2Won && (
              <Trophy size={10} className="text-accent-gold shrink-0" />
            )}
          </div>
          <span
            className={clsx(
              'text-xs font-mono font-bold shrink-0',
              isFinished && team2Won && 'text-accent-orange',
              isFinished && !team2Won && 'text-white/30',
              !isFinished && 'text-[#6E6E73]',
            )}
          >
            {score2}
          </span>
        </div>

        {/* Series status badge */}
        {isFinished && (
          <div className="mt-2 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-accent-orange/60">
              {winner} in {score1 > score2 ? score1 + score2 : score1 + score2}
            </span>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ── Conference Bracket (one side) ────────────────────────────────────────────

interface ConferenceBracketProps {
  readonly rounds: readonly BracketRound[];
  readonly label: string;
  readonly direction: 'ltr' | 'rtl';
}

function ConferenceBracket({ rounds, label, direction }: ConferenceBracketProps) {
  const orderedRounds = direction === 'rtl' ? [...rounds].reverse() : rounds;

  return (
    <div className="flex flex-col gap-3">
      {/* Conference label */}
      <h3
        className={clsx(
          'text-xs font-bold uppercase tracking-[0.2em] mb-1',
          label === 'East' ? 'text-accent-blue' : 'text-accent-orange',
          direction === 'rtl' && 'text-right',
        )}
      >
        {label}ern Conference
      </h3>

      <div
        className={clsx(
          'flex items-center gap-3',
          direction === 'rtl' && 'flex-row-reverse',
        )}
      >
        {orderedRounds.map((round, ri) => {
          // Calculate vertical spacing to align brackets
          const spacingClass =
            round.matchups.length === 4
              ? 'gap-3'
              : round.matchups.length === 2
                ? 'gap-16'
                : 'gap-0';

          return (
            <div key={round.name} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-[#86868B] uppercase tracking-wider mb-1 font-semibold">
                {round.name}
              </span>
              <motion.div
                className={clsx('flex flex-col items-center', spacingClass)}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                custom={ri}
              >
                {round.matchups.map((matchup, mi) => (
                  <MatchupCard
                    key={`${matchup.team1}-${matchup.team2}`}
                    matchup={matchup}
                    compact={round.matchups.length === 4}
                  />
                ))}
              </motion.div>
            </div>
          );
        })}

        {/* Connector lines (SVG) */}
        {orderedRounds.length > 1 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <line x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.06)" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Placeholder ──────────────────────────────────────────────────────────────

function BracketPlaceholder() {
  return (
    <GlassCard className="p-8 text-center">
      <div className="relative mx-auto mb-4 w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
        <Trophy size={28} className="text-accent-orange/40" />
        {/* Basketball court lines decorative background */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/[0.06]" />
      </div>
      <p className="text-sm text-[#86868B]">
        Playoff bracket will appear here when data is available
      </p>
    </GlassCard>
  );
}

// ── Finals Card ──────────────────────────────────────────────────────────────

function FinalsCard({ matchup }: { readonly matchup: BracketMatchup }) {
  const { team1, team2, seed1, seed2, score1, score2, winner } = matchup;
  const isFinished = winner !== null;
  const team1Won = winner === team1;
  const team2Won = winner === team2;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative"
    >
      <GlassCard
        hoverable
        tintColor="#FBBF24"
        className="w-[200px] p-4 mx-auto"
      >
        {/* Champion glow */}
        {isFinished && (
          <div className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[0_0_30px_rgba(251,191,36,0.15)]" />
        )}

        <div className="text-center mb-3">
          <Trophy size={16} className="text-accent-gold mx-auto mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold">
            NBA Finals
          </span>
        </div>

        {/* Team 1 */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[#86868B] font-mono w-3 text-right shrink-0">
              {seed1}
            </span>
            <span
              className={clsx(
                'text-sm font-bold truncate',
                isFinished && team1Won && 'text-white',
                isFinished && !team1Won && 'text-white/30',
                !isFinished && 'text-[#1D1D1F]',
              )}
            >
              {team1}
            </span>
            {team1Won && <Trophy size={12} className="text-accent-gold shrink-0" />}
          </div>
          <span
            className={clsx(
              'text-sm font-mono font-bold shrink-0',
              isFinished && team1Won && 'text-accent-gold',
              isFinished && !team1Won && 'text-white/30',
              !isFinished && 'text-[#6E6E73]',
            )}
          >
            {score1}
          </span>
        </div>

        <div className="h-px bg-black/[0.06] my-1.5" />

        {/* Team 2 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[#86868B] font-mono w-3 text-right shrink-0">
              {seed2}
            </span>
            <span
              className={clsx(
                'text-sm font-bold truncate',
                isFinished && team2Won && 'text-white',
                isFinished && !team2Won && 'text-white/30',
                !isFinished && 'text-[#1D1D1F]',
              )}
            >
              {team2}
            </span>
            {team2Won && <Trophy size={12} className="text-accent-gold shrink-0" />}
          </div>
          <span
            className={clsx(
              'text-sm font-mono font-bold shrink-0',
              isFinished && team2Won && 'text-accent-gold',
              isFinished && !team2Won && 'text-white/30',
              !isFinished && 'text-[#6E6E73]',
            )}
          >
            {score2}
          </span>
        </div>

        {/* Champion banner */}
        {isFinished && (
          <div className="mt-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-gold">
              {winner} wins {score1 > score2 ? score1 : score2}-{score1 > score2 ? score2 : score1}
            </span>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PlayoffBracket({
  rounds,
  conference = 'both',
}: PlayoffBracketProps) {
  // Determine data source: use provided rounds or fall back to mock data
  const hasData = rounds && rounds.length > 0;

  const eastRounds = useMemo(() => {
    if (hasData && conference !== 'West') {
      // If rounds provided, try to split by conference or use all
      return rounds.filter((_, i) => i < 3) as readonly BracketRound[];
    }
    return MOCK_EAST_ROUNDS;
  }, [rounds, hasData, conference]);

  const westRounds = useMemo(() => {
    if (hasData && conference !== 'East') {
      return rounds.filter((_, i) => i < 3) as readonly BracketRound[];
    }
    return MOCK_WEST_ROUNDS;
  }, [rounds, hasData, conference]);

  const finalsMatchup = useMemo(() => {
    if (hasData) {
      const finalsRound = rounds.find((r) => r.name.toLowerCase().includes('final'));
      return finalsRound?.matchups[0] ?? MOCK_FINALS[0].matchups[0];
    }
    return MOCK_FINALS[0].matchups[0];
  }, [rounds, hasData]);

  // Show placeholder if no mock and no data
  if (!hasData && !MOCK_EAST_ROUNDS.length) {
    return <BracketPlaceholder />;
  }

  if (conference === 'East') {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="overflow-x-auto no-scrollbar pb-4"
      >
        <ConferenceBracket rounds={eastRounds} label="East" direction="ltr" />
      </motion.div>
    );
  }

  if (conference === 'West') {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="overflow-x-auto no-scrollbar pb-4"
      >
        <ConferenceBracket rounds={westRounds} label="West" direction="ltr" />
      </motion.div>
    );
  }

  // Full bracket: both conferences converging to finals
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="overflow-x-auto no-scrollbar pb-4"
    >
      <div className="min-w-[800px] flex flex-col gap-6">
        {/* East bracket: LTR (Round 1 on left -> Conf Finals on right) */}
        <ConferenceBracket rounds={eastRounds} label="East" direction="ltr" />

        {/* Finals in the center */}
        <div className="flex justify-center py-2">
          <FinalsCard matchup={finalsMatchup} />
        </div>

        {/* West bracket: RTL (Round 1 on right -> Conf Finals on left) */}
        <ConferenceBracket rounds={westRounds} label="West" direction="rtl" />
      </div>
    </motion.div>
  );
}
