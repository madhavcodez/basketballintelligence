'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { animation } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface GameStats {
  readonly pts: number;
  readonly reb: number;
  readonly ast: number;
  readonly stl: number;
  readonly blk: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly min: number;
  readonly plusMinus: number;
  readonly fgm: number;
  readonly fga: number;
  readonly fg3m: number;
  readonly fg3a: number;
  readonly ftm: number;
  readonly fta: number;
  readonly tov: number;
}

interface MatchupGame {
  readonly gameId: number;
  readonly gameDate: string;
  readonly p1Team: string;
  readonly p2Team: string;
  readonly p1Won: boolean;
  readonly p2Won: boolean;
  readonly matchupStr: string;
  readonly p1Stats: GameStats;
  readonly p2Stats: GameStats;
}

interface MatchupGameLogProps {
  readonly player1: string;
  readonly player2: string;
  readonly games: ReadonlyArray<MatchupGame>;
  readonly onLoadMore?: () => void;
  readonly hasMore?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statLine(pts: number, reb: number, ast: number): string {
  return `${pts.toFixed(0)} PTS / ${reb.toFixed(0)} REB / ${ast.toFixed(0)} AST`;
}

// ── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: animation.spring.gentle,
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupGameLog({
  player1,
  player2,
  games,
  onLoadMore,
  hasMore = false,
}: MatchupGameLogProps) {
  // Get last names for compact display
  const p1Short = player1.split(' ').pop() ?? player1;
  const p2Short = player2.split(' ').pop() ?? player2;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-[100px_1fr_1fr] sm:grid-cols-[120px_1fr_1fr] gap-2 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
          Date
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[#FF6B35]/70 font-semibold">
          {p1Short}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[#0071E3]/70 font-semibold">
          {p2Short}
        </span>
      </div>

      {/* Game rows */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-0.5"
      >
        {games.map((game, index) => (
          <motion.div
            key={game.gameId}
            variants={itemVariants}
            className={clsx(
              'grid grid-cols-[100px_1fr_1fr] sm:grid-cols-[120px_1fr_1fr] gap-2',
              'px-3 py-2.5 rounded-xl transition-colors',
              index % 2 === 0 ? 'bg-white' : 'bg-transparent',
              game.p1Won && 'border-l-2 border-l-accent-orange/40',
              game.p2Won && !game.p1Won && 'border-l-2 border-l-accent-blue/40',
            )}
          >
            {/* Date + Teams */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[#1D1D1F] font-medium">
                {formatDate(game.gameDate)}
              </span>
              <span className="text-[10px] text-[#86868B]">
                {game.p1Team} vs {game.p2Team}
              </span>
            </div>

            {/* P1 stats */}
            <div className="flex flex-col gap-0.5">
              <span
                className={clsx(
                  'text-xs font-semibold',
                  game.p1Won ? 'text-[#FF6B35]' : 'text-[#6E6E73]',
                )}
              >
                {statLine(
                  game.p1Stats.pts,
                  game.p1Stats.reb,
                  game.p1Stats.ast,
                )}
              </span>
              {game.p1Won && (
                <span className="text-[9px] uppercase tracking-wider text-[#FF6B35]/60 font-bold">
                  W
                </span>
              )}
            </div>

            {/* P2 stats */}
            <div className="flex flex-col gap-0.5">
              <span
                className={clsx(
                  'text-xs font-semibold',
                  game.p2Won ? 'text-[#0071E3]' : 'text-[#6E6E73]',
                )}
              >
                {statLine(
                  game.p2Stats.pts,
                  game.p2Stats.reb,
                  game.p2Stats.ast,
                )}
              </span>
              {game.p2Won && (
                <span className="text-[9px] uppercase tracking-wider text-[#0071E3]/60 font-bold">
                  W
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center pt-2"
        >
          <button
            type="button"
            onClick={onLoadMore}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-full',
              'bg-white border border-black/[0.06]',
              'text-xs font-medium text-[#6E6E73]',
              'hover:border-black/[0.12] hover:text-[#1D1D1F]',
              'transition-all duration-200',
            )}
          >
            <ChevronDown size={14} />
            Show More
          </button>
        </motion.div>
      )}
    </div>
  );
}
