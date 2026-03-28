'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Swords, ArrowRight, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import MatchupSearch from '@/components/matchup/MatchupSearch';
import { motionPresets } from '@/lib/design-tokens';

// ── Slug helper (pure, no DB — safe for client) ─────────────────────────────

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toMatchupSlug(p1: string, p2: string): string {
  return `${slugifyName(p1)}-vs-${slugifyName(p2)}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PopularMatchupBase {
  readonly player1: string;
  readonly player2: string;
}

interface PopularMatchupRecord extends PopularMatchupBase {
  readonly p1Wins: number | null;
  readonly p2Wins: number | null;
  readonly totalGames: number | null;
}

// ── 12 Iconic Rivalries ─────────────────────────────────────────────────────

const POPULAR_MATCHUPS: readonly PopularMatchupBase[] = [
  // Modern
  { player1: 'LeBron James', player2: 'Stephen Curry' },
  { player1: 'LeBron James', player2: 'Kevin Durant' },
  { player1: 'Stephen Curry', player2: 'Kevin Durant' },
  { player1: 'Nikola Jokic', player2: 'Joel Embiid' },
  { player1: 'Giannis Antetokounmpo', player2: 'Joel Embiid' },
  { player1: 'Luka Doncic', player2: 'Jayson Tatum' },
  // New additions
  { player1: 'Kevin Durant', player2: 'Giannis Antetokounmpo' },
  { player1: 'Stephen Curry', player2: 'James Harden' },
  { player1: 'LeBron James', player2: 'Giannis Antetokounmpo' },
  { player1: 'Nikola Jokic', player2: 'Anthony Davis' },
  { player1: 'Jayson Tatum', player2: 'Jimmy Butler' },
  { player1: 'Shai Gilgeous-Alexander', player2: 'Luka Doncic' },
];

// ── Animation variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Matchup Card Component ──────────────────────────────────────────────────

interface MatchupCardProps {
  readonly matchup: PopularMatchupRecord;
  readonly slug: string;
}

function MatchupCard({ matchup, slug }: MatchupCardProps) {
  const hasRecord =
    matchup.p1Wins !== null &&
    matchup.p2Wins !== null &&
    matchup.totalGames !== null;

  const p1Leading =
    hasRecord && matchup.p1Wins !== null && matchup.p2Wins !== null
      ? matchup.p1Wins > matchup.p2Wins
      : false;
  const p2Leading =
    hasRecord && matchup.p1Wins !== null && matchup.p2Wins !== null
      ? matchup.p2Wins > matchup.p1Wins
      : false;

  return (
    <Link href={`/matchup/${slug}`}>
      <GlassCard hoverable className="p-4 sm:p-5 group">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={clsx(
                'text-sm font-bold truncate transition-colors',
                p1Leading ? 'text-[#FF6B35]' : 'text-[#FF6B35]/80 group-hover:text-[#FF6B35]',
              )}
            >
              {matchup.player1}
            </span>
          </div>

          <div className="flex flex-col items-center shrink-0 px-2">
            {hasRecord ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span
                    className={clsx(
                      'text-sm font-extrabold tabular-nums',
                      p1Leading ? 'text-[#FF6B35]' : 'text-[#1D1D1F]',
                    )}
                  >
                    {matchup.p1Wins}
                  </span>
                  <span className="text-[10px] font-bold text-[#86868B]">
                    -
                  </span>
                  <span
                    className={clsx(
                      'text-sm font-extrabold tabular-nums',
                      p2Leading ? 'text-[#0071E3]' : 'text-[#1D1D1F]',
                    )}
                  >
                    {matchup.p2Wins}
                  </span>
                </div>
                <span className="text-[9px] text-[#86868B] font-medium">
                  {matchup.totalGames}G
                </span>
              </>
            ) : (
              <span className="text-[10px] font-extrabold text-[#86868B] tracking-wider">
                vs
              </span>
            )}
          </div>

          <div className="flex flex-col items-end min-w-0 flex-1">
            <span
              className={clsx(
                'text-sm font-bold truncate transition-colors',
                p2Leading ? 'text-[#0071E3]' : 'text-[#0071E3]/80 group-hover:text-[#0071E3]',
              )}
            >
              {matchup.player2}
            </span>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MatchupLandingPage() {
  const router = useRouter();
  const [selectedP1, setSelectedP1] = useState<string | null>(null);
  const [selectedP2, setSelectedP2] = useState<string | null>(null);
  const [matchupRecords, setMatchupRecords] = useState<readonly PopularMatchupRecord[]>(
    POPULAR_MATCHUPS.map((m) => ({ ...m, p1Wins: null, p2Wins: null, totalGames: null })),
  );
  const [recordsLoading, setRecordsLoading] = useState(true);

  // Fetch real records for all 12 matchups in parallel
  useEffect(() => {
    async function fetchRecords() {
      setRecordsLoading(true);
      const promises = POPULAR_MATCHUPS.map(async (m) => {
        try {
          const res = await fetch(
            `/api/matchup?p1=${encodeURIComponent(m.player1)}&p2=${encodeURIComponent(m.player2)}`,
          );
          if (res.ok) {
            const data = await res.json();
            return {
              ...m,
              p1Wins: data.p1Wins ?? null,
              p2Wins: data.p2Wins ?? null,
              totalGames: data.totalGames ?? null,
            };
          }
        } catch {
          /* network error — show card without record */
        }
        return { ...m, p1Wins: null, p2Wins: null, totalGames: null };
      });
      const results = await Promise.all(promises);
      setMatchupRecords(results);
      setRecordsLoading(false);
    }
    fetchRecords();
  }, []);

  const handleSearchChange = useCallback(
    (p1: string | null, p2: string | null) => {
      setSelectedP1(p1);
      setSelectedP2(p2);
    },
    [],
  );

  const handleCompare = useCallback(() => {
    if (selectedP1 && selectedP2) {
      const slug = toMatchupSlug(selectedP1, selectedP2);
      router.push(`/matchup/${slug}`);
    }
  }, [selectedP1, selectedP2, router]);

  const canCompare = selectedP1 !== null && selectedP2 !== null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">
      {/* Hero Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionPresets.fadeInUp.transition}
        className="text-center mb-10"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <Swords size={28} className="text-[#FF6B35]" />
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[#1D1D1F] tracking-[0.08em] uppercase">
            Head to Head
          </h1>
          <Swords size={28} className="text-[#0071E3]" />
        </div>
        <p className="text-sm sm:text-base text-[#6E6E73] max-w-md mx-auto">
          See who really owns the rivalry
        </p>
      </motion.div>

      {/* Search Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionPresets.fadeInUp.transition, delay: 0.1 }}
        className="mb-6"
      >
        <GlassCard className="p-5 sm:p-6">
          <MatchupSearch onChange={handleSearchChange} />

          {/* Compare Button */}
          <div className="flex justify-center mt-5">
            <motion.button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              whileHover={canCompare ? { scale: 1.02 } : undefined}
              whileTap={canCompare ? { scale: 0.97 } : undefined}
              className={clsx(
                'flex items-center gap-2 px-6 py-3 rounded-full',
                'text-sm font-bold tracking-wide transition-all duration-200',
                canCompare
                  ? 'bg-[#FF6B35] text-white shadow-[0_0_20px_rgba(255,107,53,0.25)] hover:shadow-[0_0_30px_rgba(255,107,53,0.35)]'
                  : 'bg-white border border-black/[0.06] text-[#86868B] cursor-not-allowed',
              )}
            >
              Compare
              <ArrowRight size={16} />
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Popular Matchups */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <h3 className="text-xs uppercase tracking-wider text-[#86868B] font-semibold text-center">
            Popular Matchups
          </h3>
          {recordsLoading && (
            <Loader2 size={12} className="text-[#86868B] animate-spin" />
          )}
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          {matchupRecords.map((matchup) => {
            const slug = toMatchupSlug(matchup.player1, matchup.player2);
            return (
              <motion.div key={slug} variants={cardVariants}>
                <MatchupCard matchup={matchup} slug={slug} />
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
