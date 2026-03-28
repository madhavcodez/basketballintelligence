'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Crosshair,
  Target,
  Star,
  Trophy,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExploreData {
  readonly topScorers: readonly TopScorer[];
  readonly allTimeScorers: readonly CareerLeader[];
  readonly standings: readonly StandingRow[];
  readonly seasons: readonly { season: string }[];
}

interface TopScorer {
  readonly name: string;
  readonly team: string;
  readonly position: string;
  readonly games: number;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
}

interface CareerLeader {
  readonly rank: number;
  readonly name: string;
  readonly hof: string | null;
  readonly active: string | null;
  readonly value: number;
}

interface StandingRow {
  readonly conference: string;
  readonly rank: number;
  readonly team: string;
  readonly wins: number;
  readonly losses: number;
  readonly pct: number;
  readonly gb: string;
  readonly ppg: number;
  readonly oppPpg: number;
  readonly diff: number;
}

interface PlayerData {
  readonly player: { name: string; position: string };
  readonly stats: readonly PlayerSeason[];
  readonly awards: readonly { awardType: string; season: string; team: string }[];
}

interface PlayerSeason {
  readonly season: string;
  readonly team: string;
  readonly age: number;
  readonly games: number;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly fg3: number;
  readonly fg3a: number;
}

interface ShotZone {
  readonly zone: string;
  readonly area: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
  readonly avgDistance: number;
}

type StoryId = 'three-point' | 'paint' | 'rookie' | 'mvp';

interface StoryConfig {
  readonly id: StoryId;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: typeof Crosshair;
  readonly accentColor: string;
  readonly tintColor: string;
}

// ── Story Configs ────────────────────────────────────────────────────────────

const STORY_CONFIGS: readonly StoryConfig[] = [
  {
    id: 'three-point',
    title: 'The 3-Point Revolution',
    subtitle: 'How the three-pointer reshaped basketball forever',
    icon: Crosshair,
    accentColor: 'text-[#FF6B35]',
    tintColor: '#FF6B35',
  },
  {
    id: 'paint',
    title: 'Who Owns the Paint?',
    subtitle: 'The most dominant scorers in the restricted area',
    icon: Target,
    accentColor: 'text-[#0071E3]',
    tintColor: '#4DA6FF',
  },
  {
    id: 'rookie',
    title: 'Rookie Impact',
    subtitle: 'First-year players who changed the game immediately',
    icon: Star,
    accentColor: 'text-[#22C55E]',
    tintColor: '#34D399',
  },
  {
    id: 'mvp',
    title: 'The MVP Conversation',
    subtitle: 'Breaking down the most valuable player race across eras',
    icon: Trophy,
    accentColor: 'text-[#F59E0B]',
    tintColor: '#FBBF24',
  },
] as const;

// ── Well-known player names for seeded stories ───────────────────────────────

const MVP_PLAYERS = ['Nikola Jokic', 'Joel Embiid', 'Giannis Antetokounmpo', 'LeBron James', 'Stephen Curry'];
const ROOKIE_PLAYERS = ['Victor Wembanyama', 'Chet Holmgren', 'Paolo Banchero', 'Evan Mobley', 'LaMelo Ball'];
const PAINT_PLAYERS = ['Giannis Antetokounmpo', 'LeBron James', 'Anthony Davis', 'Zion Williamson', 'Nikola Jokic'];

// ── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Horizontal Bar (inline SVG for stories) ──────────────────────────────────

function StoryBar({
  label,
  value,
  maxValue,
  color,
  suffix,
}: {
  readonly label: string;
  readonly value: number;
  readonly maxValue: number;
  readonly color: string;
  readonly suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#6E6E73] truncate max-w-[140px]">{label}</span>
        <span className="text-xs font-semibold text-[#1D1D1F]">
          {value.toFixed(1)}{suffix ?? ''}
        </span>
      </div>
      <svg viewBox="0 0 200 8" className="w-full h-2" role="img">
        <rect x="0" y="0" width="200" height="8" rx="4" fill="rgba(0,0,0,0.06)" />
        <motion.rect
          x="0"
          y="0"
          height="8"
          rx="4"
          fill={color}
          fillOpacity={0.8}
          initial={{ width: 0 }}
          animate={{ width: (pct / 100) * 200 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
        />
      </svg>
    </div>
  );
}

// ── Story Card Component ─────────────────────────────────────────────────────

function StoryCard({ config }: { readonly config: StoryConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storyData, setStoryData] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  const Icon = config.icon;

  const loadStoryData = useCallback(async () => {
    if (storyData) return;
    setLoading(true);

    const result: Record<string, unknown> = {};

    if (config.id === 'three-point') {
      const explore = await fetchJSON<ExploreData>('/api/explore');
      const curryData = await fetchJSON<PlayerData>(`/api/players/${encodeURIComponent('Stephen Curry')}`);
      result.explore = explore;
      result.curryStats = curryData?.stats ?? [];
      result.allTimeScorers = explore?.allTimeScorers ?? [];
    } else if (config.id === 'paint') {
      const playerResults: { name: string; zones: readonly ShotZone[] }[] = [];
      for (const name of PAINT_PLAYERS) {
        const shotData = await fetchJSON<{ zones: readonly ShotZone[] }>(
          `/api/players/${encodeURIComponent(name)}/shots?zones=true`
        );
        if (shotData?.zones) {
          playerResults.push({ name, zones: shotData.zones });
        }
      }
      result.paintData = playerResults;
    } else if (config.id === 'rookie') {
      const rookieResults: { name: string; stats: readonly PlayerSeason[]; awards: readonly { awardType: string; season: string }[] }[] = [];
      for (const name of ROOKIE_PLAYERS) {
        const playerData = await fetchJSON<PlayerData>(`/api/players/${encodeURIComponent(name)}`);
        if (playerData?.stats) {
          rookieResults.push({
            name,
            stats: playerData.stats,
            awards: playerData.awards ?? [],
          });
        }
      }
      result.rookies = rookieResults;
    } else if (config.id === 'mvp') {
      const mvpResults: { name: string; stats: readonly PlayerSeason[]; awards: readonly { awardType: string; season: string }[] }[] = [];
      for (const name of MVP_PLAYERS) {
        const playerData = await fetchJSON<PlayerData>(`/api/players/${encodeURIComponent(name)}`);
        if (playerData?.stats) {
          mvpResults.push({
            name,
            stats: playerData.stats,
            awards: playerData.awards ?? [],
          });
        }
      }
      result.mvps = mvpResults;
    }

    setStoryData(result);
    setLoading(false);
  }, [config.id, storyData]);

  const handleToggle = useCallback(() => {
    if (!expanded) {
      loadStoryData();
    }
    setExpanded((prev) => !prev);
  }, [expanded, loadStoryData]);

  const handleCopy = useCallback(() => {
    const url = `${window.location.origin}/stories#${config.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [config.id]);

  // Derive key stat from storyData
  const keyStatDisplay = getKeyStat(config.id, storyData);

  return (
    <motion.div variants={cardVariants} id={config.id}>
      <GlassCard className="p-0 overflow-hidden" tintColor={config.tintColor} hoverable>
        {/* Card Header */}
        <button
          type="button"
          onClick={handleToggle}
          className="w-full text-left p-5 sm:p-6 focus:outline-none group"
        >
          <div className="flex items-start gap-4">
            <div
              className={clsx(
                'shrink-0 flex items-center justify-center h-12 w-12 rounded-xl',
                'bg-[#F5F5F7] border border-black/[0.06]',
              )}
            >
              <Icon size={22} className={config.accentColor} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F] font-display group-hover:text-[#1D1D1F] transition-colors">
                {config.title}
              </h3>
              <p className="mt-1 text-sm text-[#86868B] line-clamp-2">{config.subtitle}</p>

              {/* Key stat highlight */}
              {keyStatDisplay && (
                <div className="mt-3">
                  <span className={clsx('text-3xl font-extrabold font-display', config.accentColor)}>
                    {keyStatDisplay.value}
                  </span>
                  <span className="ml-2 text-xs text-[#86868B] uppercase tracking-wider">
                    {keyStatDisplay.label}
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0 pt-1">
              {expanded ? (
                <ChevronUp size={20} className="text-[#86868B]" />
              ) : (
                <ChevronDown size={20} className="text-[#86868B]" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
              className="overflow-hidden"
            >
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-black/[0.06] pt-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[#86868B]" />
                    <span className="ml-2 text-sm text-[#86868B]">Loading story data...</span>
                  </div>
                ) : (
                  <StoryContent id={config.id} data={storyData} accentColor={config.tintColor} />
                )}

                {/* Share button */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      'bg-white border border-black/[0.06] hover:bg-[#F5F5F7]',
                      copied ? 'text-[#22C55E] border-[#22C55E]/30' : 'text-[#86868B]',
                    )}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Share Story'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

// ── Key Stat Derivation ──────────────────────────────────────────────────────

function getKeyStat(
  id: StoryId,
  data: Record<string, unknown> | null,
): { value: string; label: string } | null {
  if (!data) return null;

  if (id === 'three-point') {
    const curryStats = data.curryStats as readonly PlayerSeason[] | undefined;
    if (curryStats?.length) {
      const total3s = curryStats.reduce((sum, s) => sum + (Number(s.fg3) || 0) * (Number(s.games) || 0), 0);
      if (total3s > 0) return { value: total3s.toLocaleString(), label: "Curry's Career 3PM" };
    }
    return { value: '3,000+', label: 'Curry Career 3PM' };
  }

  if (id === 'paint') {
    const paintData = data.paintData as readonly { name: string; zones: readonly ShotZone[] }[] | undefined;
    if (paintData?.length) {
      const restricted = paintData
        .map((p) => {
          const zone = p.zones.find((z) => z.zone === 'Restricted Area');
          return zone ? { name: p.name, fgPct: zone.fgPct } : null;
        })
        .filter(Boolean);
      if (restricted.length) {
        const best = restricted.sort((a, b) => (b?.fgPct ?? 0) - (a?.fgPct ?? 0))[0];
        if (best) return { value: `${best.fgPct}%`, label: `${best.name.split(' ').pop()} Restricted Area FG%` };
      }
    }
    return null;
  }

  if (id === 'rookie') {
    const rookies = data.rookies as readonly { name: string; stats: readonly PlayerSeason[] }[] | undefined;
    if (rookies?.length) {
      const firstYears = rookies
        .map((r) => ({ name: r.name, ppg: Number(r.stats[0]?.points) || 0 }))
        .filter((r) => r.ppg > 0)
        .sort((a, b) => b.ppg - a.ppg);
      if (firstYears.length) {
        return { value: firstYears[0].ppg.toFixed(1), label: `${firstYears[0].name.split(' ').pop()} Rookie PPG` };
      }
    }
    return null;
  }

  if (id === 'mvp') {
    const mvps = data.mvps as readonly { name: string; awards: readonly { awardType: string }[] }[] | undefined;
    if (mvps?.length) {
      const mvpCounts = mvps
        .map((m) => ({
          name: m.name,
          count: m.awards.filter((a) => a.awardType?.toLowerCase().includes('mvp')).length,
        }))
        .filter((m) => m.count > 0)
        .sort((a, b) => b.count - a.count);
      if (mvpCounts.length) {
        return { value: String(mvpCounts[0].count), label: `${mvpCounts[0].name.split(' ').pop()} MVP Awards` };
      }
    }
    return null;
  }

  return null;
}

// ── Story Content Renderer ───────────────────────────────────────────────────

function StoryContent({
  id,
  data,
  accentColor,
}: {
  readonly id: StoryId;
  readonly data: Record<string, unknown> | null;
  readonly accentColor: string;
}) {
  if (!data) {
    return <p className="text-sm text-[#86868B]">Unable to load story data. Please try again.</p>;
  }

  if (id === 'three-point') return <ThreePointStory data={data} color={accentColor} />;
  if (id === 'paint') return <PaintStory data={data} color={accentColor} />;
  if (id === 'rookie') return <RookieStory data={data} color={accentColor} />;
  if (id === 'mvp') return <MVPStory data={data} color={accentColor} />;

  return null;
}

// ── Three-Point Story ────────────────────────────────────────────────────────

function ThreePointStory({
  data,
  color,
}: {
  readonly data: Record<string, unknown>;
  readonly color: string;
}) {
  const curryStats = (data.curryStats ?? []) as readonly PlayerSeason[];
  const allTimeScorers = (data.allTimeScorers ?? []) as readonly CareerLeader[];

  // Show Curry's 3PA and 3P% progression
  const currySeasons = curryStats
    .filter((s) => Number(s.games) >= 20)
    .map((s) => ({
      season: s.season,
      fg3a: Number(s.fg3a) || 0,
      fg3Pct: Number(s.fg3Pct) || 0,
      fg3: Number(s.fg3) || 0,
    }));

  const max3PA = Math.max(1, ...currySeasons.map((s) => s.fg3a));

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6E6E73] leading-relaxed">
        The three-point line has transformed basketball from a mid-range game into a spacing revolution.
        Stephen Curry led this transformation, fundamentally changing how teams approach offense. His
        ability to shoot from range reshaped defensive schemes and opened up the floor for modern basketball.
      </p>

      {currySeasons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Curry&apos;s 3PA Per Game by Season</h4>
          <div className="space-y-2">
            {currySeasons.slice(-8).map((s) => (
              <StoryBar
                key={s.season}
                label={s.season}
                value={s.fg3a}
                maxValue={max3PA}
                color={color}
                suffix=" 3PA"
              />
            ))}
          </div>
        </div>
      )}

      {allTimeScorers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">All-Time Scoring Leaders</h4>
          <div className="space-y-1.5">
            {allTimeScorers.slice(0, 5).map((scorer, i) => (
              <div key={scorer.name} className="flex items-center gap-3 text-xs">
                <span className="w-5 text-right text-[#86868B] font-mono">{i + 1}</span>
                <PlayerAvatar name={scorer.name} size="sm" />
                <span className="flex-1 text-[#1D1D1F] font-medium">{scorer.name}</span>
                <span className="text-[#6E6E73] font-semibold">{Number(scorer.value).toLocaleString()}</span>
                {scorer.active === 'Y' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E] font-semibold">
                    ACTIVE
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paint Story ──────────────────────────────────────────────────────────────

function PaintStory({
  data,
  color,
}: {
  readonly data: Record<string, unknown>;
  readonly color: string;
}) {
  const paintData = (data.paintData ?? []) as readonly { name: string; zones: readonly ShotZone[] }[];

  const restrictedAreaStats = paintData
    .map((p) => {
      const zone = p.zones.find((z) => z.zone === 'Restricted Area');
      return zone
        ? { name: p.name, fgPct: zone.fgPct, attempts: zone.attempts, makes: zone.makes }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.fgPct - a.fgPct);

  const maxAttempts = Math.max(1, ...restrictedAreaStats.map((r) => r.attempts));

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6E6E73] leading-relaxed">
        While the three-point revolution captures headlines, the paint remains the most efficient
        scoring area in basketball. The restricted area is where elite athletes separate themselves --
        finishing through contact, above the rim, and with touch around the basket.
      </p>

      {restrictedAreaStats.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Restricted Area FG% Leaders</h4>
          <div className="space-y-3">
            {restrictedAreaStats.map((player) => (
              <div key={player.name} className="space-y-1">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={player.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <StoryBar
                      label={player.name}
                      value={player.fgPct}
                      maxValue={100}
                      color={color}
                      suffix="%"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[#86868B] pl-10">
                  {player.makes}/{player.attempts} makes
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {restrictedAreaStats.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Volume: Attempts in Restricted Area</h4>
          <div className="space-y-2">
            {[...restrictedAreaStats].sort((a, b) => b.attempts - a.attempts).map((player) => (
              <StoryBar
                key={`vol-${player.name}`}
                label={player.name}
                value={player.attempts}
                maxValue={maxAttempts}
                color={color}
              />
            ))}
          </div>
        </div>
      )}

      {restrictedAreaStats.length === 0 && (
        <p className="text-sm text-[#86868B] italic">Shot zone data not available for these players.</p>
      )}
    </div>
  );
}

// ── Rookie Story ─────────────────────────────────────────────────────────────

function RookieStory({
  data,
  color,
}: {
  readonly data: Record<string, unknown>;
  readonly color: string;
}) {
  const rookies = (data.rookies ?? []) as readonly {
    name: string;
    stats: readonly PlayerSeason[];
    awards: readonly { awardType: string; season: string }[];
  }[];

  const rookieSeasons = rookies
    .filter((r) => r.stats.length > 0)
    .map((r) => {
      const first = r.stats[0];
      const hasROY = r.awards.some((a) => a.awardType?.toLowerCase().includes('roy'));
      return {
        name: r.name,
        ppg: Number(first.points) || 0,
        rpg: Number(first.rebounds) || 0,
        apg: Number(first.assists) || 0,
        games: Number(first.games) || 0,
        season: first.season,
        roy: hasROY,
      };
    })
    .sort((a, b) => b.ppg - a.ppg);

  const maxPPG = Math.max(1, ...rookieSeasons.map((r) => r.ppg));

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6E6E73] leading-relaxed">
        Every generation produces a class of rookies who make an immediate impact. From Rookie of the Year
        winners to instant franchise cornerstones, these first-year players prove they belong from day one.
      </p>

      {rookieSeasons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Rookie Season Scoring</h4>
          <div className="space-y-2">
            {rookieSeasons.map((rookie) => (
              <div key={rookie.name} className="space-y-1">
                <StoryBar
                  label={`${rookie.name} (${rookie.season})`}
                  value={rookie.ppg}
                  maxValue={maxPPG}
                  color={color}
                  suffix=" PPG"
                />
                {rookie.roy && (
                  <div className="flex items-center gap-1 ml-0">
                    <Trophy size={10} className="text-[#F59E0B]" />
                    <span className="text-[10px] text-[#F59E0B] font-semibold">ROY</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rookieSeasons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Rookie Stat Comparison</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rookieSeasons.map((r) => (
              <div
                key={`chip-${r.name}`}
                className="flex flex-col gap-0.5 p-3 rounded-xl bg-white border border-black/[0.06]"
              >
                <span className="text-[10px] text-[#86868B] uppercase tracking-wider truncate">
                  {r.name.split(' ').pop()}
                </span>
                <span className="text-sm font-bold text-[#1D1D1F] font-display">{r.ppg} / {r.rpg} / {r.apg}</span>
                <span className="text-[10px] text-[#86868B]">{r.games} games</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rookieSeasons.length === 0 && (
        <p className="text-sm text-[#86868B] italic">Rookie data not available.</p>
      )}
    </div>
  );
}

// ── MVP Story ────────────────────────────────────────────────────────────────

function MVPStory({
  data,
  color,
}: {
  readonly data: Record<string, unknown>;
  readonly color: string;
}) {
  const mvps = (data.mvps ?? []) as readonly {
    name: string;
    stats: readonly PlayerSeason[];
    awards: readonly { awardType: string; season: string }[];
  }[];

  // Find MVP seasons and peak stats
  const mvpProfiles = mvps
    .filter((m) => m.stats.length > 0)
    .map((m) => {
      const mvpAwards = m.awards.filter((a) => a.awardType?.toLowerCase().includes('mvp'));
      const peakSeason = [...m.stats].sort((a, b) => Number(b.points) - Number(a.points))[0];
      const lastSeason = m.stats[m.stats.length - 1];

      // Simple "MVP Score" = PPG * 1.0 + RPG * 1.2 + APG * 1.5
      const ppg = Number(peakSeason?.points) || 0;
      const rpg = Number(peakSeason?.rebounds) || 0;
      const apg = Number(peakSeason?.assists) || 0;
      const mvpScore = ppg * 1.0 + rpg * 1.2 + apg * 1.5;

      return {
        name: m.name,
        mvpCount: mvpAwards.length,
        peakPPG: ppg,
        peakRPG: rpg,
        peakAPG: apg,
        peakSeason: peakSeason?.season ?? '--',
        lastPPG: Number(lastSeason?.points) || 0,
        lastSeason: lastSeason?.season ?? '--',
        mvpScore,
      };
    })
    .sort((a, b) => b.mvpScore - a.mvpScore);

  const maxScore = Math.max(1, ...mvpProfiles.map((m) => m.mvpScore));

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6E6E73] leading-relaxed">
        The MVP award represents the pinnacle of individual excellence in basketball. We created a
        composite &quot;MVP Score&quot; (PPG + 1.2x RPG + 1.5x APG) to visualize the all-around impact
        of the league&apos;s most valuable players at their peak seasons.
      </p>

      {mvpProfiles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">Peak Season MVP Score</h4>
          <div className="space-y-2">
            {mvpProfiles.map((mvp) => (
              <StoryBar
                key={mvp.name}
                label={mvp.name}
                value={mvp.mvpScore}
                maxValue={maxScore}
                color={color}
              />
            ))}
          </div>
        </div>
      )}

      {mvpProfiles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#1D1D1F] mb-3">MVP Winners - Peak Stats</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[400px]">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="text-left py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">Player</th>
                  <th className="text-right py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">MVPs</th>
                  <th className="text-right py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">Peak PPG</th>
                  <th className="text-right py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">RPG</th>
                  <th className="text-right py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">APG</th>
                  <th className="text-right py-2 px-2 text-[#86868B] font-semibold uppercase tracking-wider">Season</th>
                </tr>
              </thead>
              <tbody>
                {mvpProfiles.map((mvp, i) => (
                  <tr key={mvp.name} className={clsx('border-b border-black/[0.06]', i % 2 === 1 && 'bg-[#F5F5F7]')}>
                    <td className="py-2 px-2 text-[#1D1D1F] font-medium">{mvp.name}</td>
                    <td className="py-2 px-2 text-right">
                      {mvp.mvpCount > 0 ? (
                        <span className="text-[#F59E0B] font-bold">{mvp.mvpCount}</span>
                      ) : (
                        <span className="text-[#86868B]">0</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-[#1D1D1F] font-semibold">{mvp.peakPPG.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-[#6E6E73]">{mvp.peakRPG.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-[#6E6E73]">{mvp.peakAPG.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-[#86868B]">{mvp.peakSeason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mvpProfiles.length === 0 && (
        <p className="text-sm text-[#86868B] italic">MVP data not available.</p>
      )}
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function StoriesSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <SkeletonLoader width="40%" height={36} rounded="lg" />
        <SkeletonLoader width="55%" height={16} rounded="md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLoader key={`story-skeleton-${i}`} height={180} rounded="xl" />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function StoryStudioPage() {
  const mounted = useIsMounted();

  if (!mounted) return <StoriesSkeleton />;

  return (
    <motion.div
      className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Premium Page Header ──────────────────────────────────────────── */}
      <motion.div variants={cardVariants} className="text-center mb-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#FF6B35] font-semibold mb-2">Data Stories</p>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]">
          Story Studio
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#86868B] max-w-xl mx-auto">
          Narratives built from real data. Each story explores a basketball phenomenon.
        </p>
      </motion.div>

      {/* ── Page Header Card ──────────────────────────────────────────────── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-6 sm:p-8 shadow-[0_0_40px_rgba(255,107,53,0.06)]" tintColor="#FF6B35">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl bg-[#FF6B35]/[0.08] border border-[#FF6B35]/20">
              <BookOpen size={26} className="text-[#FF6B35]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-[-0.02em] text-[#1D1D1F] font-display">
                Explore Stories
              </h2>
              <p className="mt-1.5 text-sm text-[#86868B] leading-relaxed max-w-lg">
                Data-driven basketball narratives. Each story unfolds real stats to reveal patterns, trends, and the hidden geometry of the game.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STORY_CONFIGS.map((c) => {
                  const StoryIcon = c.icon;
                  return (
                    <a
                      key={c.id}
                      href={`#${c.id}`}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-black/[0.06] text-[#86868B] hover:text-[#6E6E73] hover:border-black/[0.12] transition-all"
                    >
                      <StoryIcon size={10} className={c.accentColor} />
                      {c.title}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Story Cards Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {STORY_CONFIGS.map((config) => (
          <StoryCard key={config.id} config={config} />
        ))}
      </div>
    </motion.div>
  );
}
