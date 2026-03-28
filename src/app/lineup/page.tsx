'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Plus,
  X,
  ChevronDown,
  RotateCcw,
  Share2,
  Trophy,
  Target,
  Users,
  Shield,
  Crosshair,
  Grip,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import Badge from '@/components/ui/Badge';
import { useSeasonType } from '@/lib/season-context';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Team {
  readonly abbr: string;
  readonly name: string;
  readonly teamId: number;
}

interface RosterPlayer {
  readonly name: string;
  readonly position: string;
  readonly age: number;
  readonly games: number;
  readonly gamesStarted: number;
  readonly minutes: number;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly blocks: number;
  readonly fgPct: number | null;
  readonly fg3Pct: number | null;
  readonly ftPct: number | null;
}

interface Lineup {
  readonly players: string;
  readonly gp: number;
  readonly wins: number;
  readonly losses: number;
  readonly minutes: number;
  readonly points: number;
  readonly assists: number;
  readonly rebounds: number;
  readonly steals: number;
  readonly blocks: number;
  readonly turnovers: number;
  readonly fgPct: number | null;
  readonly fg3Pct: number | null;
  readonly ftPct: number | null;
  readonly plusMinus: number;
  readonly season: string;
}

interface TeamData {
  readonly stats: ReadonlyArray<{ readonly seasonId: string }>;
  readonly roster: ReadonlyArray<RosterPlayer>;
  readonly lineups: ReadonlyArray<Lineup>;
}

type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

interface TraitGrade {
  readonly label: string;
  readonly grade: Grade;
  readonly value: number;
  readonly icon: typeof Target;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SLOT_COUNT = 5;

const gradeColors: Record<Grade, string> = {
  A: 'text-[#22C55E]',
  B: 'text-[#0071E3]',
  C: 'text-[#F59E0B]',
  D: 'text-[#FF6B35]',
  F: 'text-[#EF4444]',
};

const gradeBgColors: Record<Grade, string> = {
  A: 'bg-[#22C55E]/10 border-[#22C55E]/20',
  B: 'bg-[#0071E3]/10 border-[#0071E3]/20',
  C: 'bg-[#F59E0B]/10 border-[#F59E0B]/20',
  D: 'bg-[#FF6B35]/10 border-[#FF6B35]/20',
  F: 'bg-[#EF4444]/10 border-[#EF4444]/20',
};

const gradeGlowShadows: Record<Grade, string> = {
  A: 'shadow-[0_0_12px_rgba(52,211,153,0.15)]',
  B: 'shadow-[0_0_12px_rgba(77,166,255,0.15)]',
  C: 'shadow-[0_0_12px_rgba(251,191,36,0.15)]',
  D: 'shadow-[0_0_12px_rgba(255,107,53,0.15)]',
  F: 'shadow-[0_0_12px_rgba(248,113,113,0.15)]',
};

const gradeBarColors: Record<Grade, string> = {
  A: 'bg-[#22C55E]',
  B: 'bg-[#0071E3]',
  C: 'bg-[#F59E0B]',
  D: 'bg-[#FF6B35]',
  F: 'bg-[#EF4444]',
};

const gradePercent: Record<Grade, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
  F: 20,
};

// ─── Grading Logic ─────────────────────────────────────────────────────────

function gradeStat(value: number, thresholds: readonly [number, number, number, number]): Grade {
  if (value > thresholds[0]) return 'A';
  if (value > thresholds[1]) return 'B';
  if (value > thresholds[2]) return 'C';
  if (value > thresholds[3]) return 'D';
  return 'F';
}

function computeTraitGrades(players: ReadonlyArray<RosterPlayer>): ReadonlyArray<TraitGrade> {
  const totalPPG = players.reduce((s, p) => s + (Number(p.points) || 0), 0);
  const avgFg3 = players.reduce((s, p) => s + (Number(p.fg3Pct) || 0), 0) / players.length;
  const totalAPG = players.reduce((s, p) => s + (Number(p.assists) || 0), 0);
  const totalDef = players.reduce((s, p) => s + (Number(p.steals) || 0) + (Number(p.blocks) || 0), 0);
  const totalRPG = players.reduce((s, p) => s + (Number(p.rebounds) || 0), 0);

  return [
    { label: 'Scoring', grade: gradeStat(totalPPG, [110, 100, 90, 80]), value: totalPPG, icon: Target },
    { label: 'Shooting', grade: gradeStat(avgFg3, [0.400, 0.370, 0.340, 0.300]), value: avgFg3, icon: Crosshair },
    { label: 'Passing', grade: gradeStat(totalAPG, [25, 20, 15, 10]), value: totalAPG, icon: Users },
    { label: 'Defense', grade: gradeStat(totalDef, [8, 6, 4, 3]), value: totalDef, icon: Shield },
    { label: 'Rebounding', grade: gradeStat(totalRPG, [45, 40, 35, 30]), value: totalRPG, icon: Grip },
  ];
}

// ─── Synergy Analysis ───────────────────────────────────────────────────────

type SynergyType = 'strength' | 'weakness' | 'note';

interface SynergyFinding {
  readonly type: SynergyType;
  readonly label: string;
  readonly detail: string;
}

function analyzeSynergy(players: ReadonlyArray<RosterPlayer>): ReadonlyArray<SynergyFinding> {
  const findings: SynergyFinding[] = [];

  const shooters = players.filter((p) => (Number(p.fg3Pct) || 0) >= 0.34).length;
  const ballHandlers = players.filter((p) => (Number(p.assists) || 0) >= 5).length;
  const rimProtectors = players.filter((p) => (Number(p.blocks) || 0) >= 1.0).length;
  const eliteScorers = players.filter((p) => (Number(p.points) || 0) >= 20).length;
  const totalPPG = players.reduce((s, p) => s + (Number(p.points) || 0), 0);
  const totalDefActions = players.reduce((s, p) => s + (Number(p.steals) || 0) + (Number(p.blocks) || 0), 0);

  // Floor spacing
  if (shooters >= 4) {
    findings.push({ type: 'strength', label: 'Elite Spacing', detail: `${shooters}/5 shoot 34%+ from three — defense can't collapse into the paint` });
  } else if (shooters >= 3) {
    findings.push({ type: 'note', label: 'Adequate Spacing', detail: `${shooters} capable 3-point shooters provide serviceable floor spacing` });
  } else {
    findings.push({ type: 'weakness', label: 'Spacing Risk', detail: `Only ${shooters} reliable 3-point shooter(s) — paint traffic likely` });
  }

  // Playmaking
  if (ballHandlers === 0) {
    findings.push({ type: 'weakness', label: 'Playmaking Gap', detail: 'No clear primary playmaker — half-court offense may stagnate' });
  } else if (ballHandlers >= 3) {
    findings.push({ type: 'note', label: 'Multiple Creators', detail: `${ballHandlers} high-assist players — define clear roles to avoid ball-handling overlap` });
  } else {
    findings.push({ type: 'strength', label: 'Clear Playmaking', detail: `${ballHandlers} primary ball-handler(s) with defined role structure` });
  }

  // Rim protection
  if (rimProtectors >= 2) {
    findings.push({ type: 'strength', label: 'Rim Protection', detail: `${rimProtectors} shot-blockers (1+ BPG) — strong defensive deterrent at the rim` });
  } else if (rimProtectors === 0) {
    findings.push({ type: 'weakness', label: 'Interior Vulnerability', detail: 'No shot-blocker in the lineup — susceptible to attacking guards and bigs' });
  }

  // Scoring load
  if (eliteScorers >= 3) {
    findings.push({ type: 'strength', label: 'Star Power', detail: `${eliteScorers} players averaging 20+ PPG — nearly impossible to scheme against` });
  } else if (totalPPG >= 105) {
    findings.push({ type: 'strength', label: 'Balanced Scoring', detail: `${totalPPG.toFixed(0)} combined PPG spread across the lineup — no obvious weak spots` });
  } else if (totalPPG < 85) {
    findings.push({ type: 'weakness', label: 'Limited Offense', detail: `${totalPPG.toFixed(0)} combined PPG — this lineup may struggle to generate enough offense` });
  }

  // Defensive activity
  if (totalDefActions >= 10) {
    findings.push({ type: 'strength', label: 'Defensive Disruptors', detail: `${totalDefActions.toFixed(1)} combined STL+BLK — high-energy, pressure defense` });
  }

  return findings;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function countThreePointShooters(players: ReadonlyArray<RosterPlayer>): number {
  return players.filter((p) => (Number(p.fg3Pct) || 0) >= 0.340).length;
}

function getPositionMix(players: ReadonlyArray<RosterPlayer>): string {
  const positions = players.map((p) => p.position?.split('-')[0] || '?');
  const counts: Record<string, number> = {};
  positions.forEach((pos) => {
    counts[pos] = (counts[pos] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([pos, count]) => `${count} ${pos}`)
    .join(', ');
}

function buildShareUrl(teamAbbr: string, season: string, players: ReadonlyArray<RosterPlayer>): string {
  const names = players.map((p) => encodeURIComponent(p.name)).join(',');
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/lineup?team=${teamAbbr}&season=${season}&players=${names}`;
}

// ─── Stagger animation variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ─── Sub-Components ────────────────────────────────────────────────────────

function PlayerSlot({
  player,
  index,
  onAdd,
  onRemove,
}: {
  readonly player: RosterPlayer | null;
  readonly index: number;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex flex-col items-center gap-2"
    >
      {player ? (
        <div className="relative group">
          <div className="transition-transform duration-200 group-hover:scale-105">
            <PlayerAvatar name={player.name} size="lg" />
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={clsx(
              'absolute -top-1 -right-1 z-10',
              'h-5 w-5 rounded-full',
              'bg-[#EF4444]/80 text-white',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-[#EF4444]',
            )}
            aria-label={`Remove ${player.name}`}
          >
            <X size={10} />
          </button>
          <div className="mt-1.5 text-center max-w-[80px]">
            <p className="text-xs font-medium text-[#1D1D1F] truncate">{player.name.split(' ').pop()}</p>
            <p className="text-[10px] text-[#86868B]">{player.position}</p>
            <p className="text-[10px] font-semibold text-[#FF6B35] mt-0.5">{Number(player.points).toFixed(1)} PPG</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className={clsx(
            'h-16 w-16 rounded-full',
            'border-2 border-dashed border-black/[0.12]',
            'flex items-center justify-center',
            'text-[#86868B] hover:text-[#FF6B35]',
            'hover:border-[#FF6B35]/40',
            'hover:bg-[#FF6B35]/[0.04]',
            'transition-all duration-200',
          )}
          aria-label={`Add player to slot ${index + 1}`}
        >
          <Plus size={24} />
        </button>
      )}
    </motion.div>
  );
}

function RosterPickerModal({
  roster,
  selectedNames,
  onSelect,
  onClose,
}: {
  readonly roster: ReadonlyArray<RosterPlayer>;
  readonly selectedNames: ReadonlyArray<string>;
  readonly onSelect: (player: RosterPlayer) => void;
  readonly onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  // Dismiss on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!search.trim()) return roster;
    const q = search.toLowerCase();
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.position ?? '').toLowerCase().includes(q),
    );
  }, [roster, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 "
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-picker-title"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={clsx(
          'relative w-full max-w-md max-h-[75vh] flex flex-col',
          'bg-white ',
          'border border-black/[0.06] rounded-[20px]',
          'shadow-[0_8px_40px_rgba(0,0,0,0.12)]',
          'overflow-hidden',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 id="roster-picker-title" className="text-lg font-bold text-[#1D1D1F] font-display">Pick a Player</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <input
            type="text"
            aria-label="Filter roster players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter roster..."
            className={clsx(
              'w-full bg-white rounded-xl',
              'border border-black/[0.06]',
              'px-3 py-2.5 text-sm text-[#1D1D1F]',
              'placeholder:text-[#86868B] outline-none',
              'focus:border-[#FF6B35]/40 transition-colors',
            )}
          />
        </div>

        {/* Roster List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1.5">
          {filtered.map((player) => {
            const isSelected = selectedNames.includes(player.name);
            return (
              <button
                key={player.name}
                type="button"
                onClick={() => {
                  if (!isSelected) onSelect(player);
                }}
                disabled={isSelected}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                  'transition-colors duration-150',
                  isSelected
                    ? 'opacity-40 cursor-not-allowed bg-white'
                    : 'hover:bg-white cursor-pointer',
                )}
              >
                <PlayerAvatar name={player.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1D1D1F] truncate">
                    {player.name}
                  </p>
                  <p className="text-[11px] text-[#86868B]">
                    {player.position} &middot; {player.points} PPG &middot; {player.rebounds} RPG &middot; {player.assists} APG
                  </p>
                </div>
                {isSelected && (
                  <Badge variant="accent">Added</Badge>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-[#86868B] py-8">
              No matching players
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TraitGradeCard({ trait }: { readonly trait: TraitGrade }) {
  const Icon = trait.icon;
  const pct = gradePercent[trait.grade];
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border',
        gradeBgColors[trait.grade],
        gradeGlowShadows[trait.grade],
      )}
    >
      <Icon size={18} className={gradeColors[trait.grade]} />
      <span className={clsx('text-3xl font-extrabold font-display leading-none tracking-tight', gradeColors[trait.grade])}>
        {trait.grade}
      </span>
      <div className="w-full h-1 rounded-full bg-[#F5F5F7] overflow-hidden mt-1">
        <motion.div
          className={clsx('h-full rounded-full', gradeBarColors[trait.grade])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wider font-medium text-[#86868B]">
        {trait.label}
      </span>
    </div>
  );
}

function SynergyAnalysis({ players }: { readonly players: ReadonlyArray<RosterPlayer> }) {
  const findings = analyzeSynergy(players);
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Fit Analysis" className="mb-0" />
        <span className="text-[10px] uppercase tracking-wider font-medium text-[#86868B] bg-[#F59E0B]/[0.08] border border-[#F59E0B]/20 rounded-full px-2.5 py-1">
          Hypothetical
        </span>
      </div>
      <div className="space-y-2">
        {findings.map((finding) => {
          const Icon = finding.type === 'strength' ? CheckCircle2 : finding.type === 'weakness' ? XCircle : Info;
          const colors: Record<SynergyType, { icon: string; bg: string; label: string }> = {
            strength: { icon: 'text-[#22C55E]', bg: 'bg-[#22C55E]/[0.06] border-[#22C55E]/15', label: 'text-[#22C55E]' },
            weakness: { icon: 'text-[#EF4444]', bg: 'bg-[#EF4444]/[0.06] border-[#EF4444]/15', label: 'text-[#EF4444]' },
            note: { icon: 'text-[#0071E3]', bg: 'bg-[#0071E3]/[0.06] border-[#0071E3]/15', label: 'text-[#0071E3]' },
          };
          const c = colors[finding.type];
          return (
            <div key={finding.label} className={clsx('flex items-start gap-3 px-4 py-3 rounded-xl border', c.bg)}>
              <Icon size={15} className={clsx('mt-0.5 shrink-0', c.icon)} />
              <div className="min-w-0">
                <span className={clsx('text-sm font-semibold', c.label)}>{finding.label}</span>
                <span className="text-sm text-[#6E6E73]"> — {finding.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function LineupRow({ lineup, rank }: { readonly lineup: Lineup; readonly rank: number }) {
  const playerNames = lineup.players.split(' - ').map((n) => n.trim());
  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white transition-colors',
      rank % 2 === 0 && 'bg-[#F5F5F7]',
    )}>
      <span className="text-sm font-bold text-[#86868B] w-6 text-center">{rank}</span>
      <div className="flex -space-x-2">
        {playerNames.slice(0, 5).map((name) => (
          <PlayerAvatar key={name} name={name} size="sm" />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#6E6E73] truncate">
          {playerNames.join(', ')}
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs shrink-0">
        <span className="text-[#6E6E73]">{lineup.gp} GP</span>
        <span className="text-[#6E6E73]">{lineup.wins}W-{lineup.losses}L</span>
        <span
          className={clsx(
            'font-semibold',
            Number(lineup.plusMinus) > 0 ? 'text-[#22C55E]' : Number(lineup.plusMinus) < 0 ? 'text-[#EF4444]' : 'text-[#86868B]',
          )}
        >
          {Number(lineup.plusMinus) > 0 ? '+' : ''}{lineup.plusMinus}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────

export default function LineupSandboxPage() {
  const { seasonType } = useSeasonType();
  // ── State ──
  const [teams, setTeams] = useState<ReadonlyArray<Team>>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [seasons, setSeasons] = useState<ReadonlyArray<string>>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<ReadonlyArray<RosterPlayer | null>>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  // ── Derived State ──
  const filledPlayers = useMemo(
    () => selectedPlayers.filter((p): p is RosterPlayer => p !== null),
    [selectedPlayers],
  );
  const allFilled = filledPlayers.length === SLOT_COUNT;
  const selectedNames = useMemo(() => filledPlayers.map((p) => p.name), [filledPlayers]);

  const traitGrades = useMemo(
    () => (allFilled ? computeTraitGrades(filledPlayers) : []),
    [allFilled, filledPlayers],
  );

  const spacingCount = useMemo(
    () => (allFilled ? countThreePointShooters(filledPlayers) : 0),
    [allFilled, filledPlayers],
  );

  const positionMix = useMemo(
    () => (allFilled ? getPositionMix(filledPlayers) : ''),
    [allFilled, filledPlayers],
  );

  const combinedStats = useMemo(() => {
    if (!allFilled) return null;
    return {
      ppg: filledPlayers.reduce((s, p) => s + (Number(p.points) || 0), 0).toFixed(1),
      rpg: filledPlayers.reduce((s, p) => s + (Number(p.rebounds) || 0), 0).toFixed(1),
      apg: filledPlayers.reduce((s, p) => s + (Number(p.assists) || 0), 0).toFixed(1),
      spg: filledPlayers.reduce((s, p) => s + (Number(p.steals) || 0), 0).toFixed(1),
      bpg: filledPlayers.reduce((s, p) => s + (Number(p.blocks) || 0), 0).toFixed(1),
      fgPct: (filledPlayers.reduce((s, p) => s + (Number(p.fgPct) || 0), 0) / SLOT_COUNT).toFixed(3),
      fg3Pct: (filledPlayers.reduce((s, p) => s + (Number(p.fg3Pct) || 0), 0) / SLOT_COUNT).toFixed(3),
    };
  }, [allFilled, filledPlayers]);

  // Check if lineup exists in real data
  const matchingLineup = useMemo(() => {
    if (!allFilled || !teamData) return null;
    const nameSet = new Set(selectedNames.map((n) => n.toLowerCase()));
    return teamData.lineups.find((lineup) => {
      const lineupNames = lineup.players
        .split(' - ')
        .map((n) => n.trim().toLowerCase());
      if (lineupNames.length !== SLOT_COUNT) return false;
      return lineupNames.every((n) => nameSet.has(n));
    }) ?? null;
  }, [allFilled, teamData, selectedNames]);

  const bestLineups = useMemo(() => {
    if (!teamData) return [];
    return [...teamData.lineups]
      .sort((a, b) => Number(b.plusMinus) - Number(a.plusMinus))
      .slice(0, 5);
  }, [teamData]);

  // ── Fetch Teams ──
  useEffect(() => {
    let cancelled = false;
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams');
        if (!res.ok) throw new Error('Failed to load teams');
        const data: ReadonlyArray<Team> = await res.json();
        if (!cancelled) {
          setTeams(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load teams. Please try again.');
          setLoading(false);
        }
      }
    }
    fetchTeams();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch Team Data when team/season changes ──
  useEffect(() => {
    if (!selectedTeam) return;
    let cancelled = false;
    async function fetchTeamData() {
      setTeamLoading(true);
      try {
        const teamUrl = selectedSeason
          ? `/api/v2/teams/${selectedTeam}?season=${selectedSeason}&seasonType=${seasonType}`
          : `/api/v2/teams/${selectedTeam}?seasonType=${seasonType}`;
        const lineupsUrl = selectedSeason
          ? `/api/v2/lineups?team=${selectedTeam}&season=${selectedSeason}&seasonType=${seasonType}`
          : `/api/v2/lineups?team=${selectedTeam}&seasonType=${seasonType}`;
        const [teamRes, lineupsRes] = await Promise.all([
          fetch(teamUrl),
          fetch(lineupsUrl),
        ]);
        if (!teamRes.ok) throw new Error('Failed to load team data');
        const teamJson = await teamRes.json();
        const lineupsJson = lineupsRes.ok ? await lineupsRes.json() : { data: [] };
        if (!cancelled) {
          setTeamData({
            stats: teamJson.stats,
            roster: teamJson.roster.data,
            lineups: lineupsJson.data,
          });
          // Extract unique seasons from stats
          const uniqueSeasons = (teamJson.stats as ReadonlyArray<{ readonly seasonId: string }>)
            .map((s) => s.seasonId)
            .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);
          setSeasons(uniqueSeasons);
          if (!selectedSeason && uniqueSeasons.length > 0) {
            setSelectedSeason(uniqueSeasons[0]);
          }
          setTeamLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load team data.');
          setTeamLoading(false);
        }
      }
    }
    fetchTeamData();
    return () => { cancelled = true; };
  }, [selectedTeam, selectedSeason, seasonType]);

  // ── URL Params Initialization ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const teamParam = params.get('team');
    const seasonParam = params.get('season');
    if (teamParam) {
      setSelectedTeam(teamParam);
      if (seasonParam) setSelectedSeason(seasonParam);
    }
  }, []);

  // ── Restore players from URL after roster loads ──
  useEffect(() => {
    if (typeof window === 'undefined' || !teamData) return;
    const params = new URLSearchParams(window.location.search);
    const playersParam = params.get('players');
    if (!playersParam) return;
    const names = playersParam.split(',').map(decodeURIComponent);
    const matched = names.map((name) =>
      teamData.roster.find((p) => p.name === name) ?? null,
    );
    if (matched.some((p) => p !== null)) {
      const padded = [...matched];
      while (padded.length < SLOT_COUNT) padded.push(null);
      setSelectedPlayers(padded.slice(0, SLOT_COUNT));
    }
  }, [teamData]);

  // ── Handlers ──
  const handleSelectTeam = useCallback((abbr: string) => {
    setSelectedTeam(abbr);
    setSelectedSeason('');
    setTeamData(null);
    setSelectedPlayers(Array.from({ length: SLOT_COUNT }, () => null));
    setTeamDropdownOpen(false);
  }, []);

  const handleSelectSeason = useCallback((season: string) => {
    setSelectedSeason(season);
    setSelectedPlayers(Array.from({ length: SLOT_COUNT }, () => null));
  }, []);

  const handleAddPlayer = useCallback((player: RosterPlayer) => {
    if (pickerSlot === null) return;
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[pickerSlot] = player;
      return next;
    });
    setPickerSlot(null);
  }, [pickerSlot]);

  const handleRemovePlayer = useCallback((index: number) => {
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setSelectedPlayers(Array.from({ length: SLOT_COUNT }, () => null));
  }, []);

  const handleShare = useCallback(() => {
    if (!allFilled) return;
    const url = buildShareUrl(selectedTeam, selectedSeason, filledPlayers);
    navigator.clipboard.writeText(url).catch(() => {
      // fallback — ignore
    });
  }, [allFilled, selectedTeam, selectedSeason, filledPlayers]);

  // ── Render ──
  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <GlassCard className="p-8 max-w-md text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-[#EF4444]" />
          <p className="text-[#1D1D1F] font-medium mb-1">Something went wrong</p>
          <p className="text-sm text-[#86868B]">{error}</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-nav">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <LayoutGrid size={28} className="text-[#FF6B35]" />
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]">
              Lineup Sandbox
            </h1>
          </div>
          <p className="text-sm text-[#86868B] mb-8">
            Build and analyze 5-player combinations
          </p>
        </motion.div>

        {/* ── Controls: Team + Season ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          {/* Team Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTeamDropdownOpen((v) => !v)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                'bg-white  border border-black/[0.06]',
                'text-sm text-[#1D1D1F]',
                'hover:border-black/[0.12] transition-colors',
                'min-w-[200px]',
              )}
            >
              {selectedTeam ? (
                <TeamLogo teamAbbr={selectedTeam} size="sm" />
              ) : (
                <Shield size={14} className="text-[#86868B]" />
              )}
              <span className="flex-1 text-left truncate">
                {loading
                  ? 'Loading...'
                  : selectedTeam
                    ? teams.find((t) => t.abbr === selectedTeam)?.name ?? selectedTeam
                    : 'Select a team'}
              </span>
              <ChevronDown size={14} className={clsx('text-[#86868B] transition-transform', teamDropdownOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {teamDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={clsx(
                    'absolute z-40 mt-1 w-full max-h-64 overflow-y-auto',
                    'bg-white ',
                    'border border-black/[0.06] rounded-xl',
                    'shadow-[0_8px_40px_rgba(0,0,0,0.12)]',
                  )}
                >
                  {teams.map((team) => (
                    <button
                      key={team.abbr}
                      type="button"
                      onClick={() => handleSelectTeam(team.abbr)}
                      className={clsx(
                        'w-full text-left px-4 py-2.5 text-sm',
                        'flex items-center gap-2',
                        'hover:bg-white transition-colors',
                        selectedTeam === team.abbr
                          ? 'text-[#FF6B35] font-medium'
                          : 'text-[#6E6E73]',
                      )}
                    >
                      <TeamLogo teamAbbr={team.abbr} size="sm" />
                      {team.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Season Pills */}
          {seasons.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {seasons.slice(0, 6).map((season) => (
                <button
                  key={season}
                  type="button"
                  onClick={() => handleSelectSeason(season)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium',
                    'border transition-all duration-200',
                    selectedSeason === season
                      ? 'bg-[#FF6B35]/10 border-[#FF6B35]/30 text-[#FF6B35]'
                      : 'bg-white border-black/[0.06] text-[#86868B] hover:text-[#6E6E73] hover:border-black/[0.12]',
                  )}
                >
                  {season}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Loading State ── */}
        {teamLoading && (
          <div className="space-y-4 mb-8">
            <SkeletonLoader width="100%" height={100} rounded="xl" />
            <SkeletonLoader width="100%" height={200} rounded="xl" />
          </div>
        )}

        {/* ── Lineup Builder ── */}
        {teamData && !teamLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* 5 Player Slots */}
            <GlassCard className="p-5 sm:p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-[#6E6E73] uppercase tracking-wider">
                  Your Lineup
                </h3>
                <div className="flex gap-2">
                  {allFilled && (
                    <button
                      type="button"
                      onClick={handleShare}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20',
                        'hover:bg-[#0071E3]/20 transition-colors',
                      )}
                    >
                      <Share2 size={12} />
                      Share
                    </button>
                  )}
                  {filledPlayers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-white text-[#86868B] border border-black/[0.06]',
                        'hover:text-[#6E6E73] transition-colors',
                      )}
                    >
                      <RotateCcw size={12} />
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <motion.div
                variants={containerVariants}
                className="flex items-start justify-center gap-4 sm:gap-8 flex-wrap"
              >
                {selectedPlayers.map((player, i) => (
                  <PlayerSlot
                    key={i}
                    player={player}
                    index={i}
                    onAdd={() => setPickerSlot(i)}
                    onRemove={() => handleRemovePlayer(i)}
                  />
                ))}
              </motion.div>
            </GlassCard>

            {/* ── Lineup Analysis (when 5 selected) ── */}
            <AnimatePresence>
              {allFilled && combinedStats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-8 mb-8"
                >
                  {/* Combined Stats */}
                  <GlassCard className="p-5 sm:p-6" tintColor="#FF6B35">
                    <SectionHeader title="Combined Stats" eyebrow="Lineup Analysis" className="mb-4" />
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                      {[
                        { label: 'PPG', value: combinedStats.ppg },
                        { label: 'RPG', value: combinedStats.rpg },
                        { label: 'APG', value: combinedStats.apg },
                        { label: 'SPG', value: combinedStats.spg },
                        { label: 'BPG', value: combinedStats.bpg },
                        { label: 'FG%', value: (Number(combinedStats.fgPct) * 100).toFixed(1) },
                        { label: '3P%', value: (Number(combinedStats.fg3Pct) * 100).toFixed(1) },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl bg-white border border-black/[0.06]"
                        >
                          <span className="text-lg font-bold text-[#1D1D1F] font-display">
                            {stat.value}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-medium text-[#86868B]">
                            {stat.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Trait Grades */}
                  <GlassCard className="p-5 sm:p-6">
                    <SectionHeader title="Trait Grades" className="mb-4" />
                    <div className="grid grid-cols-5 gap-2 sm:gap-3">
                      {traitGrades.map((trait) => (
                        <TraitGradeCard key={trait.label} trait={trait} />
                      ))}
                    </div>
                  </GlassCard>

                  {/* Synergy / Fit Analysis */}
                  <SynergyAnalysis players={filledPlayers} />

                  {/* Size Profile + Spacing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <GlassCard className="p-5">
                      <h4 className="text-sm font-semibold text-[#6E6E73] mb-3">Size Profile</h4>
                      <p className="text-lg font-bold text-[#1D1D1F] font-display">{positionMix}</p>
                      <p className="text-xs text-[#86868B] mt-1">Position distribution</p>
                    </GlassCard>

                    <GlassCard className="p-5">
                      <h4 className="text-sm font-semibold text-[#6E6E73] mb-3">Spacing</h4>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-extrabold text-[#1D1D1F] font-display">
                          {spacingCount}
                        </span>
                        <span className="text-sm text-[#86868B] mb-1">/ 5 shooters</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {Array.from({ length: SLOT_COUNT }).map((_, i) => (
                          <div
                            key={i}
                            className={clsx(
                              'h-2 flex-1 rounded-full',
                              i < spacingCount ? 'bg-[#22C55E]' : 'bg-white',
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-[#86868B] mt-1.5">
                        Players shooting .340+ from 3
                      </p>
                    </GlassCard>
                  </div>

                  {/* Real Lineup Match */}
                  <GlassCard className="p-5 sm:p-6">
                    <SectionHeader
                      title="Lineup Performance"
                      action={
                        matchingLineup ? (
                          <Badge variant="success">Real Data</Badge>
                        ) : (
                          <Badge variant="warning">Projected</Badge>
                        )
                      }
                      className="mb-4"
                    />
                    {matchingLineup ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Games', value: matchingLineup.gp },
                          { label: 'Record', value: `${matchingLineup.wins}W-${matchingLineup.losses}L` },
                          { label: '+/-', value: matchingLineup.plusMinus },
                          { label: 'Minutes', value: matchingLineup.minutes },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white border border-black/[0.06]"
                          >
                            <span className="text-lg font-bold text-[#1D1D1F] font-display">
                              {s.value}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-medium text-[#86868B]">
                              {s.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F59E0B]/[0.06] border border-[#F59E0B]/15">
                        <TrendingUp size={16} className="text-[#F59E0B] shrink-0" />
                        <p className="text-sm text-[#6E6E73]">
                          This exact lineup combination was not found in the database. Stats above are summed from individual player averages.
                        </p>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Best Lineups for Team ── */}
            {bestLineups.length > 0 && (
              <motion.div variants={itemVariants}>
                <GlassCard className="p-5 sm:p-6">
                  <SectionHeader
                    title="Best Lineups"
                    eyebrow={teams.find((t) => t.abbr === selectedTeam)?.name}
                    action={
                      <div className="flex items-center gap-1.5 text-xs text-[#86868B]">
                        <Trophy size={12} />
                        By +/-
                      </div>
                    }
                    className="mb-4"
                  />
                  <div className="space-y-1">
                    {bestLineups.map((lineup, i) => (
                      <LineupRow key={lineup.players} lineup={lineup} rank={i + 1} />
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Empty State ── */}
        {!selectedTeam && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <GlassCard className="p-12 text-center">
              <LayoutGrid size={40} className="mx-auto mb-4 text-[#86868B]" />
              <h3 className="text-lg font-semibold text-[#1D1D1F] font-display mb-1">
                Select a Team to Get Started
              </h3>
              <p className="text-sm text-[#86868B] max-w-sm mx-auto">
                Choose a team above, then pick 5 players to build your lineup and see the analysis.
              </p>
            </GlassCard>
          </motion.div>
        )}
      </div>

      {/* ── Player Picker Modal ── */}
      <AnimatePresence>
        {pickerSlot !== null && teamData && (
          <RosterPickerModal
            roster={teamData.roster}
            selectedNames={selectedNames}
            onSelect={handleAddPlayer}
            onClose={() => setPickerSlot(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
