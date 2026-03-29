import { getDb } from './db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Insight {
  readonly id: string;
  readonly type: 'trend' | 'milestone' | 'didYouKnow' | 'rivalry' | 'record';
  readonly title: string;
  readonly description: string;
  readonly icon: string; // lucide icon name
  readonly severity: 'info' | 'highlight' | 'alert';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeAll<T>(sql: string, params: readonly unknown[]): readonly T[] {
  try { return getDb().prepare(sql).all(...params) as T[]; }
  catch { return []; }
}

function safeGet<T>(sql: string, params: readonly unknown[]): T | undefined {
  try { return getDb().prepare(sql).get(...params) as T | undefined; }
  catch { return undefined; }
}

function mid(type: string, key: string): string {
  return `${type}-${key}`.replace(/\s+/g, '-').toLowerCase();
}

/** Escape SQL LIKE wildcards so user input is treated literally. */
function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (c) => `\\${c}`);
}

const SEVERITY_ORDER: Readonly<Record<string, number>> = { highlight: 0, alert: 1, info: 2 };
const PTS_MILESTONES = [10000, 15000, 20000, 25000, 30000] as const;

function prioritize(insights: readonly Insight[], max: number): readonly Insight[] {
  const sorted = [...insights].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));
  return Object.freeze(sorted.slice(0, max));
}

function trendInsight(stat: string, label: string, diff: number, prev: string, curr: string): Insight | null {
  if (Math.abs(diff) < 3) return null;
  const up = diff > 0;
  const titles: Record<string, [string, string]> = {
    pts: ['Scoring Surge', 'Scoring Dip'],
    ast: ['Playmaking Leap', 'Playmaking Drop'],
    trb: ['Rebounding Boost', 'Rebounding Decline'],
  };
  const [upTitle, downTitle] = titles[stat] ?? ['Stat Jump', 'Stat Drop'];
  return {
    id: mid('trend', stat), type: 'trend',
    title: up ? upTitle : downTitle,
    description: `${up ? '+' : ''}${diff.toFixed(1)} ${label} from ${prev} to ${curr}`,
    icon: 'TrendingUp',
    severity: up ? 'highlight' : (stat === 'pts' ? 'alert' : 'info'),
  };
}

// ── Player Insights ─────────────────────────────────────────────────────────

export function getPlayerInsights(playerName: string, _season?: string): readonly Insight[] {
  const insights: Insight[] = [];

  // 1. Trend alerts — compare latest two seasons
  const rows = safeAll<{ season: string; pts: number; ast: number; trb: number }>(
    `SELECT Season as season, CAST(PTS as FLOAT) as pts, CAST(AST as FLOAT) as ast,
            CAST(TRB as FLOAT) as trb
     FROM player_stats_pergame WHERE Player = ? AND CAST(G as INTEGER) >= 10
     ORDER BY Season DESC LIMIT 2`, [playerName]);

  if (rows.length === 2) {
    const [c, p] = rows;
    for (const t of [
      trendInsight('pts', 'PPG', c.pts - p.pts, p.season, c.season),
      trendInsight('ast', 'APG', c.ast - p.ast, p.season, c.season),
      trendInsight('trb', 'RPG', c.trb - p.trb, p.season, c.season),
    ]) { if (t) insights.push(t); }
  }

  // 2. Milestone proximity — career point totals
  const ct = safeGet<{ totalPts: number }>(
    `SELECT SUM(CAST(PTS as FLOAT) * CAST(G as INTEGER)) as totalPts
     FROM player_stats_pergame WHERE Player = ?`, [playerName]);

  if (ct?.totalPts) {
    for (const ms of PTS_MILESTONES) {
      const rem = ms - ct.totalPts;
      if (rem > 0 && rem <= 500) {
        insights.push({ id: mid('milestone', `pts-${ms}`), type: 'milestone',
          title: `Approaching ${(ms / 1000).toFixed(0)}K Points`,
          description: `Only ~${Math.round(rem)} career points away from ${ms.toLocaleString()}`,
          icon: 'Target', severity: 'highlight' });
        break;
      }
      if (rem <= 0 && rem > -500) {
        insights.push({ id: mid('milestone', `pts-${ms}-reached`), type: 'milestone',
          title: `${(ms / 1000).toFixed(0)}K Career Points`,
          description: `Surpassed ${ms.toLocaleString()} career points — elite company`,
          icon: 'Trophy', severity: 'highlight' });
        break;
      }
    }
  }

  // 3. "Did you know" — HOF, #1 pick
  const pi = safeGet<{ hof: number }>(
    `SELECT HOF as hof FROM players WHERE Player = ?`, [playerName]);
  if (pi?.hof === 1) {
    insights.push({ id: mid('dyk', 'hof'), type: 'didYouKnow',
      title: 'Hall of Famer',
      description: `${playerName} is enshrined in the Basketball Hall of Fame`,
      icon: 'Lightbulb', severity: 'highlight' });
  }

  const di = safeGet<{ pick: number; year: number }>(
    `SELECT CAST(Pk as INTEGER) as pick, CAST(Year as INTEGER) as year
     FROM draft WHERE Player = ?`, [playerName]);
  if (di?.pick === 1) {
    insights.push({ id: mid('dyk', 'draft1'), type: 'didYouKnow',
      title: '#1 Overall Pick',
      description: `Selected first overall in the ${di.year} NBA Draft`,
      icon: 'Lightbulb', severity: 'info' });
  }

  // 4. Award streaks
  const awards = safeAll<{ awardType: string }>(
    `SELECT award_type as awardType FROM awards WHERE Player = ?`, [playerName]);
  const counts = new Map<string, number>();
  for (const a of awards) counts.set(a.awardType, (counts.get(a.awardType) ?? 0) + 1);
  for (const [type, count] of counts) {
    if (count >= 3 && (type.includes('All-Star') || type.includes('All-NBA'))) {
      insights.push({ id: mid('record', type), type: 'record',
        title: `${count}x ${type}`,
        description: `Selected to ${count} ${type} teams throughout career`,
        icon: 'Trophy', severity: 'highlight' });
    }
  }

  return prioritize(insights, 5);
}

// ── Team Insights ───────────────────────────────────────────────────────────

export function getTeamInsights(teamAbbr: string, season?: string): readonly Insight[] {
  const insights: Insight[] = [];
  const targetSeason = season
    || safeGet<{ s: string }>(`SELECT MAX(Season) as s FROM standings`, [])?.s || '';

  const st = safeGet<{ pct: number; wins: number; losses: number }>(
    `SELECT CAST(PCT as FLOAT) as pct, CAST(W as INTEGER) as wins, CAST(L as INTEGER) as losses
     FROM standings WHERE Team LIKE ? ESCAPE '\\' AND Season = ?`, [`%${escapeLike(teamAbbr)}%`, targetSeason]);

  if (st && st.pct >= 0.7) {
    insights.push({ id: mid('record', 'winpct'), type: 'record', title: 'Elite Win Rate',
      description: `${st.wins}-${st.losses} (${(st.pct * 100).toFixed(1)}%) — one of the league's best`,
      icon: 'Trophy', severity: 'highlight' });
  } else if (st && st.pct <= 0.3) {
    insights.push({ id: mid('trend', 'winpct'), type: 'trend', title: 'Struggling Season',
      description: `${st.wins}-${st.losses} record — a rebuilding year`,
      icon: 'TrendingUp', severity: 'alert' });
  }

  const ta = safeGet<{ offRating: number; defRating: number }>(
    `SELECT CAST(OFF_RATING as FLOAT) as offRating, CAST(DEF_RATING as FLOAT) as defRating
     FROM team_stats_advanced
     WHERE TEAM_NAME LIKE ? ESCAPE '\\' AND Season = (SELECT MAX(Season) FROM team_stats_advanced)`,
    [`%${escapeLike(teamAbbr)}%`]);

  if (ta?.offRating && ta.offRating >= 115) {
    insights.push({ id: mid('record', 'offense'), type: 'record', title: 'Offensive Powerhouse',
      description: `${ta.offRating.toFixed(1)} offensive rating — elite scoring efficiency`,
      icon: 'Trophy', severity: 'highlight' });
  }
  if (ta?.defRating && ta.defRating <= 108) {
    insights.push({ id: mid('record', 'defense'), type: 'record', title: 'Defensive Fortress',
      description: `${ta.defRating.toFixed(1)} defensive rating — stifling opponents`,
      icon: 'Swords', severity: 'highlight' });
  }

  return Object.freeze(insights.slice(0, 3));
}

// ── Explore Insights ────────────────────────────────────────────────────────

export function getExploreInsights(): readonly Insight[] {
  const insights: Insight[] = [];

  const ts = safeGet<{ name: string; points: number; team: string }>(
    `SELECT s.Player as name, CAST(s.PTS as FLOAT) as points, s.Tm as team
     FROM player_stats_pergame s
     WHERE s.Season = (SELECT MAX(Season) FROM player_stats_pergame)
       AND CAST(s.G as INTEGER) >= 20
     ORDER BY CAST(s.PTS as FLOAT) DESC LIMIT 1`, []);
  if (ts) {
    insights.push({ id: mid('record', 'top-scorer'), type: 'record', title: 'Scoring Leader',
      description: `${ts.name} (${ts.team}) leads the league at ${ts.points.toFixed(1)} PPG`,
      icon: 'Trophy', severity: 'highlight' });
  }

  const pc = safeGet<{ count: number }>(
    `SELECT COUNT(DISTINCT Player) as count FROM player_stats_pergame`, []);
  if (pc) {
    insights.push({ id: mid('dyk', 'player-count'), type: 'didYouKnow', title: 'Vast History',
      description: `This database tracks ${pc.count.toLocaleString()} unique player-seasons across NBA history`,
      icon: 'Lightbulb', severity: 'info' });
  }

  const sr = safeGet<{ earliest: string; latest: string }>(
    `SELECT MIN(Season) as earliest, MAX(Season) as latest FROM player_stats_pergame`, []);
  if (sr) {
    insights.push({ id: mid('dyk', 'season-range'), type: 'didYouKnow', title: 'Decades of Data',
      description: `Stats spanning from ${sr.earliest} to ${sr.latest}`,
      icon: 'Lightbulb', severity: 'info' });
  }

  return Object.freeze(insights.slice(0, 3));
}
