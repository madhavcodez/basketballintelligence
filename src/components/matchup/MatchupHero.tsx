'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, animate } from 'framer-motion';
import clsx from 'clsx';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { colors } from '@/lib/design-tokens';

// ── Team Color Map ──────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, string> = {
  LAL: '#552583', GSW: '#1D428A', BOS: '#007A33', MIA: '#98002E',
  CHI: '#CE1141', CLE: '#860038', DEN: '#0E2240', PHO: '#1D1160',
  MIL: '#00471B', PHI: '#006BB6', DAL: '#00538C', BRK: '#000000',
  ATL: '#E03A3E', CHA: '#1D1160', DET: '#C8102E', HOU: '#CE1141',
  IND: '#002D62', LAC: '#C8102E', MEM: '#5D76A9', MIN: '#0C2340',
  NOP: '#0C2340', NYK: '#006BB6', OKC: '#007AC1', ORL: '#0077C0',
  POR: '#E03A3E', SAC: '#5A2D81', SAS: '#C4CED4', TOR: '#CE1141',
  UTA: '#002B5C', WAS: '#002B5C',
  // Historical
  NJN: '#002A60', SEA: '#00653A', VAN: '#00B2A9', CHH: '#1D1160',
  NOH: '#0C2340', NOK: '#0C2340', WSB: '#002B5C', CHO: '#1D1160',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface MatchupHeroProps {
  readonly player1: string;
  readonly player2: string;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly totalGames: number;
  readonly headToHeadRecord: string;
  readonly p1Team: string;
  readonly p2Team: string;
  readonly recentGames?: readonly { readonly p1Won: boolean }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTeamColor(team: string): string {
  return TEAM_COLORS[team] ?? '#86868B';
}

function getStreakNarrative(
  games: readonly { readonly p1Won: boolean }[],
  p1Name: string,
  p2Name: string,
): string {
  if (games.length === 0) return '';
  const firstResult = games[0].p1Won;
  let streak = 0;
  for (const g of games) {
    if (g.p1Won === firstResult) streak++;
    else break;
  }
  const name = firstResult ? p1Name.split(' ').pop() : p2Name.split(' ').pop();
  if (streak >= 2) return `${name} has won ${streak} straight`;
  return '';
}

// ── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  delay = 0,
  className,
  style,
}: {
  readonly value: number;
  readonly delay?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      delay,
      onUpdate: (v) => setDisplayed(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay]);

  return <span className={className} style={style}>{displayed}</span>;
}

// ── Spring Config ────────────────────────────────────────────────────────────

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 20 };

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupHero({
  player1,
  player2,
  p1Wins,
  p2Wins,
  totalGames,
  headToHeadRecord,
  p1Team,
  p2Team,
  recentGames = [],
}: MatchupHeroProps) {
  const p1Leading = p1Wins > p2Wins;
  const p2Leading = p2Wins > p1Wins;

  const p1Color = getTeamColor(p1Team);
  const p2Color = getTeamColor(p2Team);

  const streakNarrative = getStreakNarrative(recentGames, player1, player2);

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl',
        'border border-black/[0.06]',
      )}
      style={{
        background: `linear-gradient(135deg, ${p1Color}08 0%, #FFFFFF 35%, #FFFFFF 65%, ${p2Color}08 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* Subtle team-color tint — left */}
      <div
        className="pointer-events-none absolute top-0 left-0 w-1/3 h-full"
        style={{
          background: `radial-gradient(ellipse at left center, ${p1Color}08, transparent 70%)`,
        }}
      />
      {/* Subtle team-color tint — right */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-1/3 h-full"
        style={{
          background: `radial-gradient(ellipse at right center, ${p2Color}08, transparent 70%)`,
        }}
      />

      <div className="relative z-10 px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">
          {/* ── Player 1 — Left side ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SNAPPY, delay: 0 }}
            className="flex flex-col items-center sm:items-start text-center sm:text-left flex-1 min-w-0"
          >
            <h2
              className={clsx(
                'text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display leading-tight',
              )}
              style={{
                color: p1Leading ? p1Color : '#1D1D1F',
              }}
            >
              {player1}
            </h2>

            {/* Team badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.8 }}
              className="mt-2 flex items-center gap-2"
            >
              <Badge variant={p1Leading ? 'accent' : 'default'}>{p1Team}</Badge>
              <Link
                href={`/player/${player1.toLowerCase().replace(/\s+/g, '-')}/timeline`}
                className="inline-flex items-center gap-1 text-[10px] text-[#86868B] hover:text-[#FF6B35] transition-colors"
              >
                <Clock size={10} /> Timeline
              </Link>
            </motion.div>
          </motion.div>

          {/* ── Center — Record ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING_SNAPPY, delay: 0.15 }}
            className="flex flex-col items-center shrink-0"
          >
            {/* VS badge — static, no pulsing */}
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.2 }}
              className="w-10 h-10 rounded-full bg-[#F5F5F7] border border-black/[0.06] flex items-center justify-center mb-3"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <span className="text-xs font-extrabold text-[#6E6E73]">VS</span>
            </motion.div>

            {/* Win numbers — animated count-up */}
            <div className="flex items-baseline gap-2 sm:gap-3">
              <AnimatedNumber
                value={p1Wins}
                delay={0.3}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tabular-nums"
                style={{ color: p1Leading ? p1Color : '#1D1D1F' }}
              />
              <span className="text-xl sm:text-2xl font-bold text-[#86868B]">
                &ndash;
              </span>
              <AnimatedNumber
                value={p2Wins}
                delay={0.3}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tabular-nums"
                style={{ color: p2Leading ? p2Color : '#1D1D1F' }}
              />
            </div>

            {/* Record text */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.6 }}
              className="mt-1 text-xs sm:text-sm text-[#6E6E73] font-medium"
            >
              {headToHeadRecord}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="mt-0.5 text-[10px] text-[#86868B]"
            >
              {totalGames} game{totalGames !== 1 ? 's' : ''}
            </motion.p>

            {/* Win Streak Tracker — last 10 games */}
            {recentGames.length > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1">
                  {recentGames.map((game, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        ...SPRING_SNAPPY,
                        delay: 0.8 + i * 0.05,
                      }}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: game.p1Won
                          ? '#22C55E'
                          : '#EF4444',
                      }}
                    />
                  ))}
                </div>
                {streakNarrative && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 1.3 }}
                    className="text-[10px] text-[#86868B] italic"
                  >
                    {streakNarrative}
                  </motion.p>
                )}
              </div>
            )}
          </motion.div>

          {/* ── Player 2 — Right side ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SNAPPY, delay: 0 }}
            className="flex flex-col items-center sm:items-end text-center sm:text-right flex-1 min-w-0"
          >
            <h2
              className={clsx(
                'text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display leading-tight',
              )}
              style={{
                color: p2Leading ? p2Color : '#1D1D1F',
              }}
            >
              {player2}
            </h2>

            {/* Team badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.8 }}
              className="mt-2 flex items-center gap-2"
            >
              <Link
                href={`/player/${player2.toLowerCase().replace(/\s+/g, '-')}/timeline`}
                className="inline-flex items-center gap-1 text-[10px] text-[#86868B] hover:text-[#0071E3] transition-colors"
              >
                <Clock size={10} /> Timeline
              </Link>
              <Badge variant={p2Leading ? 'accent' : 'default'}>{p2Team}</Badge>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
