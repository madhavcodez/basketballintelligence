'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Film,
  Play,
  User,
  Shield,
  Clock,
  Target,
  Activity,
  Calendar,
  Tag,
  ChevronRight,
  Pencil,
  Check,
  X,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import ClipPlayer from '@/components/film/ClipPlayer';
import ClipCard from '@/components/film/ClipCard';
import TagBadge from '@/components/film/TagBadge';

// ── Types ────────────────────────────────────────────────────────────────────

interface ClipData {
  readonly id: number;
  readonly video_id: number;
  readonly title: string | null;
  readonly start_time: number;
  readonly end_time: number;
  readonly duration: number;
  readonly thumbnail_path: string | null;
  readonly quarter: number | null;
  readonly game_clock: string | null;
  readonly shot_clock: number | null;
  readonly score_home: number | null;
  readonly score_away: number | null;
  readonly possession_type: string | null;
  readonly play_type: string | null;
  readonly primary_action: string | null;
  readonly shot_result: string | null;
  readonly primary_player: string | null;
  readonly secondary_player: string | null;
  readonly defender: string | null;
  readonly confidence: number;
  readonly manually_verified: number;
  readonly created_at: string;
}

interface VideoData {
  readonly id: number;
  readonly title: string;
  readonly filepath: string;
  readonly game_date: string | null;
  readonly home_team: string | null;
  readonly away_team: string | null;
  readonly season: string | null;
  readonly status: string;
}

interface ClipTag {
  readonly name: string;
  readonly category: string;
  readonly confidence: number;
}

interface Annotation {
  readonly id: number;
  readonly clip_id: number;
  readonly timestamp: number;
  readonly annotation_type: string;
  readonly content: string;
  readonly x: number | null;
  readonly y: number | null;
}

interface RelatedClip {
  readonly id: number;
  readonly title: string | null;
  readonly start_time: number;
  readonly end_time: number;
  readonly duration: number;
  readonly thumbnail_path: string | null;
  readonly play_type: string | null;
  readonly primary_action: string | null;
  readonly primary_player: string | null;
  readonly quarter: number | null;
  readonly game_clock: string | null;
  readonly confidence: number;
}

interface PlayerContext {
  readonly name: string;
  readonly position: string | null;
  readonly height: string | null;
  readonly weight: number | null;
  readonly college: string | null;
  readonly active: number | null;
  readonly fromYear: number | null;
  readonly toYear: number | null;
  readonly latestStats: {
    readonly season: string;
    readonly team: string;
    readonly ppg: number;
    readonly rpg: number;
    readonly apg: number;
    readonly spg: number;
    readonly bpg: number;
    readonly fgPct: number | null;
    readonly threePct: number | null;
  } | null;
}

interface ClipDetailResponse {
  readonly clip: ClipData;
  readonly video: VideoData | null;
  readonly tags: readonly ClipTag[];
  readonly annotations: readonly Annotation[];
  readonly relatedClips: readonly RelatedClip[];
  readonly playerContext?: PlayerContext | null;
  readonly defenderContext?: PlayerContext | null;
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
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

function mapAnnotationType(type: string): 'play' | 'event' | 'highlight' | 'note' {
  const mapping: Record<string, 'play' | 'event' | 'highlight' | 'note'> = {
    action: 'play',
    player_id: 'event',
    highlight: 'highlight',
    note: 'note',
  };
  return mapping[type] ?? 'note';
}

function resolveTagCategory(category: string): 'action' | 'player' | 'team' | 'context' | 'quality' | 'custom' {
  const valid = ['action', 'player', 'team', 'context', 'quality', 'custom'] as const;
  const lower = category.toLowerCase();
  for (const c of valid) {
    if (lower === c) return c;
  }
  return 'custom';
}

// ── Detail Row Component ────────────────────────────────────────────────────

interface DetailRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number | null;
  readonly accent?: boolean;
  readonly valueAdornment?: React.ReactNode;
}

function DetailRow({ icon, label, value, accent = false, valueAdornment }: DetailRowProps) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="text-[#86868B] shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[#86868B]/50 font-semibold">
          {label}
        </div>
        <div className={clsx(
          'flex items-center gap-1.5 text-sm font-medium truncate mt-0.5',
          accent ? 'text-[#FF6B35]' : 'text-[#1D1D1F]',
        )}>
          {valueAdornment}
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClipViewerPage() {
  const { id } = useParams();

  const [data, setData] = useState<ClipDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch clip data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function fetchClip() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/film/clips/${id}`);

        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setError('Clip not found');
          } else {
            const errData = await res.json().catch(() => ({}));
            setError(errData.error ?? 'Failed to load clip');
          }
          setLoading(false);
          return;
        }

        const clipData: ClipDetailResponse = await res.json();
        setData(clipData);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to connect to the server');
          setLoading(false);
        }
      }
    }

    fetchClip();
    return () => { cancelled = true; };
  }, [id]);

  // ── Loading State ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24 space-y-6">
        <SkeletonLoader height={16} width={160} rounded="full" />
        <SkeletonLoader className="w-full aspect-video rounded-[20px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonLoader height={280} rounded="xl" className="w-full" />
          <SkeletonLoader height={280} rounded="xl" className="w-full" />
        </div>
      </div>
    );
  }

  // ── Error / Not Found State ─────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24">
        <Link
          href="/film"
          className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors mb-6"
        >
          <ArrowLeft size={12} /> Back to Film Room
        </Link>

        <GlassCard className="p-8 text-center">
          <Film size={40} className="mx-auto mb-3 text-[#86868B]" />
          <h3 className="text-lg font-bold text-[#1D1D1F] mb-1">
            {error === 'Clip not found' ? 'Clip Not Found' : 'Unable to Load Clip'}
          </h3>
          <p className="text-sm text-[#86868B] max-w-md mx-auto">
            {error ?? 'An unexpected error occurred.'}
          </p>
          <Link
            href="/film"
            className={clsx(
              'inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full',
              'bg-white border border-black/[0.06]',
              'text-xs text-[#6E6E73] hover:text-[#1D1D1F] transition-colors',
            )}
          >
            <ArrowLeft size={12} />
            Back to Film Room
          </Link>
        </GlassCard>
      </div>
    );
  }

  // ── Destructure data ────────────────────────────────────────────────────────

  const { clip, video, tags, annotations, relatedClips } = data;

  const playerAnnotations = annotations.map((a) => ({
    id: a.id,
    time: a.timestamp,
    label: a.content,
    type: mapAnnotationType(a.annotation_type),
  }));

  const clipTitle = clip.title ?? clip.play_type ?? 'Untitled Clip';
  const gameInfo = video?.home_team && video?.away_team
    ? `${video.home_team} vs ${video.away_team}`
    : null;
  const scoreDisplay = clip.score_home !== null && clip.score_away !== null
    ? `${clip.score_home} - ${clip.score_away}`
    : null;

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* ── Back Button ───────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-4">
          <Link
            href="/film"
            className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors"
          >
            <ArrowLeft size={12} /> Back to Film Room
          </Link>
        </motion.div>

        {/* ── Video Player ──────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-6">
          <ClipPlayer
            src={video?.filepath ?? null}
            poster={clip.thumbnail_path}
            startTime={clip.start_time}
            endTime={clip.end_time}
            annotations={playerAnnotations}
          />
        </motion.div>

        {/* ── Clip Title + Inline Edit ────────────────────────────────── */}
        <ClipEditor clip={clip} onUpdate={(updated) => setData({ ...data, clip: updated })} />

        {/* ── Tags Row ──────────────────────────────────────────────────── */}
        {tags.length > 0 && (
          <motion.div variants={fadeSlideUp} className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <TagBadge
                key={`${tag.category}-${tag.name}`}
                name={tag.name}
                category={resolveTagCategory(tag.category)}
                size="md"
              />
            ))}
          </motion.div>
        )}

        {/* ── Two-Column Detail Cards ───────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Left: Clip Details */}
          <GlassCard tintColor="#FF6B35" className="p-5 sm:p-6 bg-white border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Film size={16} className="text-[#FF6B35]" />
              <h2 className="text-sm font-bold text-[#FF6B35] uppercase tracking-wider">
                Clip Details
              </h2>
            </div>

            <div className="space-y-1 divide-y divide-black/[0.06]">
              <DetailRow
                icon={<Target size={14} />}
                label="Play Type"
                value={clip.play_type}
                accent
              />
              <DetailRow
                icon={<Activity size={14} />}
                label="Action"
                value={clip.primary_action}
              />
              <DetailRow
                icon={<Play size={14} />}
                label="Result"
                value={clip.shot_result}
              />
              <DetailRow
                icon={<Clock size={14} />}
                label="Quarter"
                value={clip.quarter !== null ? `Q${clip.quarter}` : null}
              />
              <DetailRow
                icon={<Clock size={14} />}
                label="Game Clock"
                value={clip.game_clock}
              />
              {scoreDisplay && (
                <DetailRow
                  icon={<Activity size={14} />}
                  label="Score"
                  value={scoreDisplay}
                />
              )}
              {clip.possession_type && (
                <DetailRow
                  icon={<Target size={14} />}
                  label="Possession"
                  value={clip.possession_type}
                />
              )}
            </div>
          </GlassCard>

          {/* Right: Analysis */}
          <GlassCard tintColor="#4DA6FF" className="p-5 sm:p-6 bg-white border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-[#0071E3]" />
              <h2 className="text-sm font-bold text-[#0071E3] uppercase tracking-wider">
                Analysis
              </h2>
            </div>

            <div className="space-y-1 divide-y divide-black/[0.06]">
              <DetailRow
                icon={<User size={14} />}
                label="Primary Player"
                value={clip.primary_player}
                accent
                valueAdornment={clip.primary_player ? <PlayerAvatar name={clip.primary_player} size="sm" className="!h-5 !w-5" /> : undefined}
              />
              {clip.secondary_player && (
                <DetailRow
                  icon={<User size={14} />}
                  label="Secondary Player"
                  value={clip.secondary_player}
                  valueAdornment={<PlayerAvatar name={clip.secondary_player} size="sm" className="!h-5 !w-5" />}
                />
              )}
              <DetailRow
                icon={<Shield size={14} />}
                label="Defender"
                value={clip.defender}
                valueAdornment={clip.defender ? <PlayerAvatar name={clip.defender} size="sm" className="!h-5 !w-5" /> : undefined}
              />
              {gameInfo && video?.home_team && video?.away_team && (
                <div className="flex items-center gap-3 py-2">
                  <div className="text-[#86868B] shrink-0"><Activity size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#86868B]/50 font-semibold">
                      Matchup
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#1D1D1F] mt-0.5">
                      <TeamLogo teamAbbr={video.home_team} size="sm" />
                      <span>{video.home_team}</span>
                      <span className="text-[#86868B] text-xs">vs</span>
                      <TeamLogo teamAbbr={video.away_team} size="sm" />
                      <span>{video.away_team}</span>
                    </div>
                  </div>
                </div>
              )}
              <DetailRow
                icon={<Calendar size={14} />}
                label="Game Date"
                value={formatDate(video?.game_date ?? null)}
              />
              {video?.season && (
                <DetailRow
                  icon={<Calendar size={14} />}
                  label="Season"
                  value={video.season}
                />
              )}

              {/* Confidence meter */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#86868B]/50 font-semibold">
                    AI Confidence
                  </span>
                  <span className={clsx(
                    'text-sm font-bold',
                    clip.confidence >= 0.8 ? 'text-[#22C55E]' :
                    clip.confidence >= 0.5 ? 'text-accent-gold' :
                    'text-[#EF4444]',
                  )}>
                    {formatConfidence(clip.confidence)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F5F5F7] overflow-hidden">
                  <motion.div
                    className={clsx(
                      'h-full rounded-full',
                      clip.confidence >= 0.8 ? 'bg-[#22C55E]' :
                      clip.confidence >= 0.5 ? 'bg-accent-gold' :
                      'bg-[#EF4444]',
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${clip.confidence * 100}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Player Stats from basketball.db ─────────────────────────── */}
        {data.playerContext?.latestStats && (
          <motion.div variants={fadeSlideUp}>
            <GlassCard tintColor="#34D399" className="p-5 sm:p-6 bg-white border border-black/[0.06]">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-[#22C55E]" />
                <h2 className="text-sm font-bold text-[#22C55E] uppercase tracking-wider">
                  Player Stats — {data.playerContext.latestStats.season}
                </h2>
                {data.playerContext.position && (
                  <Badge variant="default">{data.playerContext.position}</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                {[
                  { label: 'PPG', value: data.playerContext.latestStats.ppg },
                  { label: 'RPG', value: data.playerContext.latestStats.rpg },
                  { label: 'APG', value: data.playerContext.latestStats.apg },
                  { label: 'SPG', value: data.playerContext.latestStats.spg },
                  { label: 'BPG', value: data.playerContext.latestStats.bpg },
                  { label: 'FG%', value: data.playerContext.latestStats.fgPct != null ? (Number(data.playerContext.latestStats.fgPct) * 100).toFixed(1) : null },
                  { label: '3P%', value: data.playerContext.latestStats.threePct != null ? (Number(data.playerContext.latestStats.threePct) * 100).toFixed(1) : null },
                ].map((stat) => (
                  stat.value != null && (
                    <div key={stat.label} className="text-center p-2 rounded-xl bg-[#F5F5F7]">
                      <div className="text-lg font-bold font-mono text-[#1D1D1F]">{stat.value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[#86868B]">{stat.label}</div>
                    </div>
                  )
                ))}
              </div>
              {data.playerContext.college && (
                <div className="mt-3 text-xs text-[#86868B]">
                  {data.playerContext.college} &middot; {data.playerContext.fromYear}–{data.playerContext.toYear ?? 'Present'}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* ── Related Clips ─────────────────────────────────────────────── */}
        {relatedClips.length > 0 && (
          <motion.section variants={fadeSlideUp}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D1D1F] tracking-wide">
                Related Clips
              </h2>
              <span className="text-xs text-[#86868B]">
                {relatedClips.length} clip{relatedClips.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div
              className={clsx(
                'flex gap-4 overflow-x-auto pb-4',
                'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#86868B]/20',
                'snap-x snap-mandatory',
              )}
            >
              {relatedClips.map((related) => (
                <div key={related.id} className="snap-start shrink-0">
                  <Link href={`/film/${related.id}`}>
                    <ClipCard
                      clip={related}
                      size="sm"
                      onClick={undefined}
                    />
                  </Link>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}

// ── Clip Editor Component ──────────────────────────────────────────────────

const PLAY_TYPES = [
  'Isolation', 'Pick & Roll', 'Pick & Pop', 'Post Up', 'Spot Up',
  'Catch & Shoot', 'Handoff', 'Cut', 'Off Screen', 'Transition',
  'Fastbreak', 'Putback', 'PnR Ball Handler', 'Miscellaneous',
];

const ACTIONS = [
  'Drive', 'Pull-up Jumper', 'Catch & Shoot', 'Layup', 'Dunk',
  'Hook Shot', 'Fadeaway', 'Stepback', 'Three Pointer', 'Pass',
  'Screen', 'Rebound', 'Steal', 'Block', 'Turnover', 'Free Throw',
  'Shot Attempt', 'Assist', 'Made Shot', 'Missed Shot',
];

const RESULTS = ['Made', 'Missed', 'Blocked', 'Fouled', 'And-1'];

function ClipEditor({ clip, onUpdate }: {
  readonly clip: ClipData;
  readonly onUpdate: (updated: ClipData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    play_type: clip.play_type ?? '',
    primary_action: clip.primary_action ?? '',
    primary_player: clip.primary_player ?? '',
    shot_result: clip.shot_result ?? '',
    defender: clip.defender ?? '',
  });

  const clipTitle = clip.title ?? clip.play_type ?? 'Untitled Clip';
  const needsReview = !clip.manually_verified && !clip.primary_player;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Build clean title from form
      const parts: string[] = [];
      if (form.primary_player) { parts.push(form.primary_player); parts.push('-'); }
      if (form.play_type) parts.push(form.play_type);
      if (form.primary_action && form.primary_action !== form.play_type) parts.push(form.primary_action);
      if (form.shot_result) parts.push(`(${form.shot_result})`);
      const title = parts.join(' ') || clipTitle;

      const res = await fetch(`/api/film/clips/${clip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          play_type: form.play_type || null,
          primary_action: form.primary_action || null,
          primary_player: form.primary_player || null,
          shot_result: form.shot_result || null,
          defender: form.defender || null,
          reviewed: 1,
        }),
      });

      if (res.ok) {
        const { clip: updated } = await res.json();
        onUpdate(updated);
        setEditing(false);
      }
    } catch { /* silent */ }
    setSaving(false);
  }, [clip.id, form, clipTitle, onUpdate]);

  if (!editing) {
    return (
      <motion.div variants={fadeSlideUp} className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#1D1D1F] tracking-tight">
            {clipTitle}
          </h1>
          {clip.play_type && <Badge variant="accent">{clip.play_type}</Badge>}
          {clip.primary_action && <Badge variant="default">{clip.primary_action}</Badge>}
          {clip.manually_verified === 1 && <Badge variant="success">Verified</Badge>}
          {needsReview && (
            <Badge variant="warning">Needs Tag</Badge>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#F5F5F7] border border-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white transition-colors"
          >
            <Pencil size={12} />
            {needsReview ? 'Tag This Clip' : 'Edit'}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeSlideUp}
      className="mb-6"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
    >
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
            <Pencil size={14} className="text-[#FF6B35]" />
            Tag This Clip
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              <X size={12} /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? 'Saving...' : 'Save & Verify'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Play Type */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
              Play Type
            </label>
            <select
              value={form.play_type}
              onChange={(e) => setForm({ ...form, play_type: e.target.value })}
              className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] outline-none focus:border-[#FF6B35]/40"
            >
              <option value="">Select play type...</option>
              {PLAY_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
              Action
            </label>
            <select
              value={form.primary_action}
              onChange={(e) => setForm({ ...form, primary_action: e.target.value })}
              className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] outline-none focus:border-[#FF6B35]/40"
            >
              <option value="">Select action...</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Player */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
              Primary Player
            </label>
            <input
              type="text"
              value={form.primary_player}
              onChange={(e) => setForm({ ...form, primary_player: e.target.value })}
              placeholder="e.g. LeBron James"
              className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 outline-none focus:border-[#FF6B35]/40"
            />
          </div>

          {/* Result */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
              Shot Result
            </label>
            <select
              value={form.shot_result}
              onChange={(e) => setForm({ ...form, shot_result: e.target.value })}
              className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] outline-none focus:border-[#FF6B35]/40"
            >
              <option value="">None</option>
              {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Defender */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
              Defender
            </label>
            <input
              type="text"
              value={form.defender}
              onChange={(e) => setForm({ ...form, defender: e.target.value })}
              placeholder="e.g. Klay Thompson"
              className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 outline-none focus:border-[#FF6B35]/40"
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
