import { getDb } from './db';

// ── Types ───────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'draft'
  | 'rookie_season'
  | 'award'
  | 'trade'
  | 'career_high'
  | 'milestone'
  | 'peak_season'
  | 'season';

export interface TimelineEvent {
  readonly season: string;
  readonly year: number;
  readonly type: TimelineEventType;
  readonly title: string;
  readonly description: string;
  readonly team: string;
  readonly stats?: SeasonStats;
  readonly significance: 'major' | 'notable' | 'minor';
  readonly icon: string;
}

export interface SeasonStats {
  readonly season: string;
  readonly team: string;
  readonly games: number;
  readonly ppg: number;
  readonly rpg: number;
  readonly apg: number;
  readonly spg: number;
  readonly bpg: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
  readonly ftPct: number;
  readonly minutes: number;
  readonly per?: number;
  readonly ws?: number;
  readonly bpm?: number;
  readonly vorp?: number;
}

export interface CareerTimeline {
  readonly player: string;
  readonly playerInfo: PlayerInfo | null;
  readonly events: readonly TimelineEvent[];
  readonly careerStats: CareerSummary;
}

interface PlayerInfo {
  readonly position: string;
  readonly height: string;
  readonly college: string;
  readonly birthDate: string;
  readonly hof: number;
  readonly active: number;
  readonly fromYear: number;
  readonly toYear: number;
  readonly personId?: number | null;
}

export interface CareerSummary {
  readonly totalPoints: number;
  readonly totalGames: number;
  readonly totalAssists: number;
  readonly totalRebounds: number;
  readonly peakSeason: string;
  readonly teams: readonly string[];
  readonly yearsActive: number;
  readonly awardsCount: number;
}

// ── Icon Mapping ────────────────────────────────────────────────────────────

const EVENT_ICON_MAP: Readonly<Record<TimelineEventType, string>> = {
  draft: 'star',
  rookie_season: 'sparkles',
  award: 'trophy',
  trade: 'repeat',
  career_high: 'trending-up',
  milestone: 'flag',
  peak_season: 'crown',
  season: 'circle',
};

// ── Team Abbreviation → Full Name ───────────────────────────────────────────

const TEAM_NAMES: Readonly<Record<string, string>> = {
  ATL: 'Atlanta Hawks',
  BOS: 'Boston Celtics',
  BRK: 'Brooklyn Nets',
  NJN: 'New Jersey Nets',
  CHA: 'Charlotte Hornets',
  CHO: 'Charlotte Hornets',
  CHH: 'Charlotte Hornets',
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks',
  DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors',
  HOU: 'Houston Rockets',
  IND: 'Indiana Pacers',
  LAC: 'Los Angeles Clippers',
  LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies',
  VAN: 'Vancouver Grizzlies',
  MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves',
  NOP: 'New Orleans Pelicans',
  NOH: 'New Orleans Hornets',
  NOK: 'New Orleans/Oklahoma City Hornets',
  NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder',
  SEA: 'Seattle SuperSonics',
  ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers',
  PHO: 'Phoenix Suns',
  POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings',
  SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz',
  WAS: 'Washington Wizards',
  WSB: 'Washington Bullets',
};

function teamFullName(abbrev: string): string {
  return TEAM_NAMES[abbrev] ?? abbrev;
}

// ── DB Row Types ────────────────────────────────────────────────────────────

interface PerGameRow {
  readonly Season: string;
  readonly Player: string;
  readonly Tm: string;
  readonly Pos: string;
  readonly Age: number;
  readonly G: number;
  readonly GS: number;
  readonly MP: number;
  readonly PTS: number;
  readonly TRB: number;
  readonly AST: number;
  readonly STL: number;
  readonly BLK: number;
  readonly TOV: number;
  readonly FGPct: number | null;
  readonly '3PPct': number | null;
  readonly FTPct: number | null;
  readonly Awards: string | null;
}

interface AdvancedRow {
  readonly Season: string;
  readonly Player: string;
  readonly Tm: string;
  readonly Age: number;
  readonly G: number;
  readonly MP: number;
  readonly PER: number | null;
  readonly TSPct: number | null;
  readonly USGPct: number | null;
  readonly WS48: number | null;
  readonly WS: number | null;
  readonly OWS: number | null;
  readonly DWS: number | null;
  readonly OBPM: number | null;
  readonly DBPM: number | null;
  readonly BPM: number | null;
  readonly VORP: number | null;
}

interface DraftRow {
  readonly Year: number;
  readonly Rk: string;
  readonly Pk: string;
  readonly Tm: string;
  readonly Player: string;
  readonly College: string | null;
}

interface AwardRow {
  readonly Season: string;
  readonly Player: string;
  readonly Tm: string;
  readonly award_type: string;
}

interface PlayerRow {
  readonly Player: string;
  readonly Pos: string;
  readonly Height: string;
  readonly Weight: string;
  readonly College: string;
  readonly BirthDate: string;
  readonly HOF: number;
  readonly Active: number;
  readonly From: number;
  readonly To: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function parseSeasonYear(season: string): number {
  if (!season || typeof season !== 'string') return 0;
  const parts = season.split('-');
  const yearStr = parts[0]?.trim();
  if (!yearStr) return 0;
  const year = parseInt(yearStr, 10);
  return Number.isFinite(year) ? year : 0;
}

function round1(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function num(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return value;
}

function significanceOrder(s: 'major' | 'notable' | 'minor'): number {
  if (s === 'major') return 0;
  if (s === 'notable') return 1;
  return 2;
}

// ── Season Stats Builder ────────────────────────────────────────────────────

function buildSeasonStats(
  pg: PerGameRow,
  adv: AdvancedRow | undefined,
): SeasonStats {
  return {
    season: pg.Season,
    team: pg.Tm,
    games: num(pg.G),
    ppg: round1(pg.PTS),
    rpg: round1(pg.TRB),
    apg: round1(pg.AST),
    spg: round1(pg.STL),
    bpg: round1(pg.BLK),
    fgPct: round1(pg.FGPct),
    fg3Pct: round1(pg['3PPct']),
    ftPct: round1(pg.FTPct),
    minutes: round1(pg.MP),
    per: adv ? round1(adv.PER) : undefined,
    ws: adv ? round1(adv.WS) : undefined,
    bpm: adv ? round1(adv.BPM) : undefined,
    vorp: adv ? round1(adv.VORP) : undefined,
  };
}

// ── Data Fetching ───────────────────────────────────────────────────────────

function fetchPerGameStats(playerName: string): readonly PerGameRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT Season, Player, Tm, Pos, Age, G, GS, MP,
           PTS, TRB, AST, STL, BLK, TOV,
           FGPct, "3PPct", FTPct, Awards
    FROM player_stats_pergame
    WHERE Player = ?
    ORDER BY Season ASC
  `).all(playerName) as PerGameRow[];
}

function fetchAdvancedStats(playerName: string): readonly AdvancedRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT Season, Player, Tm, Age, G, MP,
           PER, TSPct, USGPct, WS48, WS, OWS, DWS,
           OBPM, DBPM, BPM, VORP
    FROM player_stats_advanced
    WHERE Player = ?
    ORDER BY Season ASC
  `).all(playerName) as AdvancedRow[];
}

function fetchDraftInfo(playerName: string): DraftRow | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT Year, Rk, Pk, Tm, Player, College
    FROM draft
    WHERE Player = ?
    LIMIT 1
  `).get(playerName) as DraftRow | undefined;
}

function fetchAwards(playerName: string): readonly AwardRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT Season, Player, Tm, award_type
    FROM awards
    WHERE Player = ?
    ORDER BY Season ASC
  `).all(playerName) as AwardRow[];
}

function fetchPlayerInfo(playerName: string): PlayerRow | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT Player, Pos, Height, Weight, College, BirthDate,
           HOF, Active, "From", "To"
    FROM players
    WHERE Player = ?
    LIMIT 1
  `).get(playerName) as PlayerRow | undefined;
}

// ── Consolidated Season Data ────────────────────────────────────────────────

interface ConsolidatedSeason {
  readonly season: string;
  readonly perGame: PerGameRow;
  readonly advanced: AdvancedRow | undefined;
  readonly teamsPlayed: readonly string[];
}

/**
 * Build a deduplicated list of seasons. For seasons with a "TOT" row,
 * use the TOT row for aggregate stats but collect the individual team
 * abbreviations from the non-TOT rows.
 */
function consolidateSeasons(
  perGame: readonly PerGameRow[],
  advanced: readonly AdvancedRow[],
): readonly ConsolidatedSeason[] {
  const advancedBySeason = new Map<string, AdvancedRow>();
  for (const row of advanced) {
    // Prefer the TOT row for advanced stats too
    if (row.Tm === 'TOT' || !advancedBySeason.has(row.Season)) {
      advancedBySeason.set(row.Season, row);
    }
  }

  // Group per-game rows by season
  const seasonMap = new Map<string, { tot: PerGameRow | null; teams: string[] }>();
  for (const row of perGame) {
    const existing = seasonMap.get(row.Season);
    if (!existing) {
      seasonMap.set(row.Season, {
        tot: row.Tm === 'TOT' ? row : null,
        teams: row.Tm !== 'TOT' ? [row.Tm] : [],
      });
    } else {
      if (row.Tm === 'TOT') {
        seasonMap.set(row.Season, { ...existing, tot: row });
      } else {
        seasonMap.set(row.Season, {
          ...existing,
          teams: [...existing.teams, row.Tm],
        });
      }
    }
  }

  const result: ConsolidatedSeason[] = [];
  const seenSeasons = new Set<string>();

  // Maintain original season ordering
  for (const row of perGame) {
    if (seenSeasons.has(row.Season)) continue;
    seenSeasons.add(row.Season);

    const entry = seasonMap.get(row.Season);
    if (!entry) continue;

    // If TOT exists, use it; otherwise use the single row
    const primaryRow = entry.tot ?? row;
    // Only include this row if it IS the primary (skip individual team rows when TOT exists)
    if (entry.tot && row.Tm !== 'TOT' && row !== primaryRow) {
      // This case won't fire because we skip after first seen, but guard anyway
      continue;
    }

    const teamsPlayed = entry.teams.length > 0
      ? entry.teams
      : [primaryRow.Tm];

    result.push({
      season: row.Season,
      perGame: primaryRow,
      advanced: advancedBySeason.get(row.Season),
      teamsPlayed,
    });
  }

  return result;
}

// ── Event Generators ────────────────────────────────────────────────────────

function createDraftEvent(draft: DraftRow): TimelineEvent {
  const season = `${draft.Year}-${String(draft.Year + 1).slice(2)}`;
  const pickNum = draft.Pk ?? draft.Rk ?? '?';
  const team = draft.Tm;
  const college = draft.College ?? 'N/A';

  return {
    season,
    year: draft.Year,
    type: 'draft',
    title: `Drafted #${pickNum} Overall`,
    description: `Selected by ${teamFullName(team)} with the #${pickNum} pick${college !== 'N/A' ? ` out of ${college}` : ''}.`,
    team,
    significance: 'major',
    icon: EVENT_ICON_MAP.draft,
  };
}

function createRookieEvent(cs: ConsolidatedSeason): TimelineEvent {
  const stats = buildSeasonStats(cs.perGame, cs.advanced);
  return {
    season: cs.season,
    year: parseSeasonYear(cs.season),
    type: 'rookie_season',
    title: 'Rookie Season',
    description: `First NBA season with ${teamFullName(cs.perGame.Tm)}: ${stats.ppg} PPG, ${stats.rpg} RPG, ${stats.apg} APG in ${stats.games} games.`,
    team: cs.perGame.Tm,
    stats,
    significance: 'major',
    icon: EVENT_ICON_MAP.rookie_season,
  };
}

function createAwardEvent(award: AwardRow): TimelineEvent {
  const year = parseSeasonYear(award.Season);
  return {
    season: award.Season,
    year,
    type: 'award',
    title: `${award.award_type}`,
    description: `Won ${award.award_type} award for the ${award.Season} season with ${teamFullName(award.Tm)}.`,
    team: award.Tm,
    significance: 'major',
    icon: EVENT_ICON_MAP.award,
  };
}

function detectTradeEvents(
  seasons: readonly ConsolidatedSeason[],
): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (let i = 0; i < seasons.length; i++) {
    const current = seasons[i];

    // Mid-season trade: player has TOT row and multiple teams
    if (current.perGame.Tm === 'TOT' && current.teamsPlayed.length > 1) {
      // Generate trade events for each team after the first
      for (let t = 1; t < current.teamsPlayed.length; t++) {
        const toTeam = current.teamsPlayed[t];
        events.push({
          season: current.season,
          year: parseSeasonYear(current.season),
          type: 'trade',
          title: `Traded to ${teamFullName(toTeam)}`,
          description: `Traded mid-season to ${teamFullName(toTeam)} during the ${current.season} season.`,
          team: toTeam,
          significance: 'notable',
          icon: EVENT_ICON_MAP.trade,
        });
      }
    }

    // Off-season move: different team between consecutive seasons
    if (i > 0) {
      const prev = seasons[i - 1];
      const prevTeam = prev.perGame.Tm === 'TOT'
        ? prev.teamsPlayed[prev.teamsPlayed.length - 1] ?? 'TOT'
        : prev.perGame.Tm;
      const currTeam = current.perGame.Tm === 'TOT'
        ? current.teamsPlayed[0] ?? 'TOT'
        : current.perGame.Tm;

      if (prevTeam !== 'TOT' && currTeam !== 'TOT' && prevTeam !== currTeam) {
        events.push({
          season: current.season,
          year: parseSeasonYear(current.season),
          type: 'trade',
          title: `Joined ${teamFullName(currTeam)}`,
          description: `Moved from ${teamFullName(prevTeam)} to ${teamFullName(currTeam)} before the ${current.season} season.`,
          team: currTeam,
          significance: 'notable',
          icon: EVENT_ICON_MAP.trade,
        });
      }
    }
  }

  return events;
}

function detectCareerHighs(
  seasons: readonly ConsolidatedSeason[],
): readonly TimelineEvent[] {
  if (seasons.length < 3) return [];

  const events: TimelineEvent[] = [];

  let bestPts: ConsolidatedSeason | null = null;
  let bestTrb: ConsolidatedSeason | null = null;
  let bestAst: ConsolidatedSeason | null = null;

  for (const cs of seasons) {
    const pg = cs.perGame;
    if (num(pg.G) < 10) continue; // Skip very small sample sizes

    if (!bestPts || num(pg.PTS) > num(bestPts.perGame.PTS)) bestPts = cs;
    if (!bestTrb || num(pg.TRB) > num(bestTrb.perGame.TRB)) bestTrb = cs;
    if (!bestAst || num(pg.AST) > num(bestAst.perGame.AST)) bestAst = cs;
  }

  if (bestPts) {
    events.push({
      season: bestPts.season,
      year: parseSeasonYear(bestPts.season),
      type: 'career_high',
      title: 'Career-High Scoring',
      description: `Averaged a career-best ${round1(bestPts.perGame.PTS)} points per game in ${bestPts.season}.`,
      team: bestPts.perGame.Tm,
      significance: 'notable',
      icon: EVENT_ICON_MAP.career_high,
    });
  }

  if (bestTrb && bestTrb.season !== bestPts?.season) {
    events.push({
      season: bestTrb.season,
      year: parseSeasonYear(bestTrb.season),
      type: 'career_high',
      title: 'Career-High Rebounding',
      description: `Averaged a career-best ${round1(bestTrb.perGame.TRB)} rebounds per game in ${bestTrb.season}.`,
      team: bestTrb.perGame.Tm,
      significance: 'notable',
      icon: EVENT_ICON_MAP.career_high,
    });
  }

  if (bestAst && bestAst.season !== bestPts?.season && bestAst.season !== bestTrb?.season) {
    events.push({
      season: bestAst.season,
      year: parseSeasonYear(bestAst.season),
      type: 'career_high',
      title: 'Career-High Assists',
      description: `Averaged a career-best ${round1(bestAst.perGame.AST)} assists per game in ${bestAst.season}.`,
      team: bestAst.perGame.Tm,
      significance: 'notable',
      icon: EVENT_ICON_MAP.career_high,
    });
  }

  return events;
}

// ── Milestone Detection ─────────────────────────────────────────────────────

const POINT_MILESTONES = [5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000] as const;
const REBOUND_MILESTONES = [3000, 5000, 7000, 10000, 12000, 15000] as const;
const ASSIST_MILESTONES = [2000, 3000, 5000, 7000, 10000] as const;
const GAME_MILESTONES = [500, 750, 1000, 1250, 1500] as const;

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function detectMilestones(
  seasons: readonly ConsolidatedSeason[],
): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];

  let cumulPoints = 0;
  let cumulRebounds = 0;
  let cumulAssists = 0;
  let cumulGames = 0;

  let nextPtsIdx = 0;
  let nextRebIdx = 0;
  let nextAstIdx = 0;
  let nextGamesIdx = 0;

  for (const cs of seasons) {
    const pg = cs.perGame;
    const games = num(pg.G);
    const seasonPts = Math.round(games * num(pg.PTS));
    const seasonReb = Math.round(games * num(pg.TRB));
    const seasonAst = Math.round(games * num(pg.AST));

    cumulPoints += seasonPts;
    cumulRebounds += seasonReb;
    cumulAssists += seasonAst;
    cumulGames += games;

    // Check point milestones
    while (nextPtsIdx < POINT_MILESTONES.length && cumulPoints >= POINT_MILESTONES[nextPtsIdx]) {
      const milestone = POINT_MILESTONES[nextPtsIdx];
      events.push({
        season: cs.season,
        year: parseSeasonYear(cs.season),
        type: 'milestone',
        title: `${formatNumber(milestone)} Career Points`,
        description: `Surpassed ${formatNumber(milestone)} career points during the ${cs.season} season.`,
        team: cs.perGame.Tm,
        significance: milestone >= 20000 ? 'major' : 'notable',
        icon: EVENT_ICON_MAP.milestone,
      });
      nextPtsIdx++;
    }

    // Check rebound milestones
    while (nextRebIdx < REBOUND_MILESTONES.length && cumulRebounds >= REBOUND_MILESTONES[nextRebIdx]) {
      const milestone = REBOUND_MILESTONES[nextRebIdx];
      events.push({
        season: cs.season,
        year: parseSeasonYear(cs.season),
        type: 'milestone',
        title: `${formatNumber(milestone)} Career Rebounds`,
        description: `Surpassed ${formatNumber(milestone)} career rebounds during the ${cs.season} season.`,
        team: cs.perGame.Tm,
        significance: milestone >= 10000 ? 'major' : 'notable',
        icon: EVENT_ICON_MAP.milestone,
      });
      nextRebIdx++;
    }

    // Check assist milestones
    while (nextAstIdx < ASSIST_MILESTONES.length && cumulAssists >= ASSIST_MILESTONES[nextAstIdx]) {
      const milestone = ASSIST_MILESTONES[nextAstIdx];
      events.push({
        season: cs.season,
        year: parseSeasonYear(cs.season),
        type: 'milestone',
        title: `${formatNumber(milestone)} Career Assists`,
        description: `Surpassed ${formatNumber(milestone)} career assists during the ${cs.season} season.`,
        team: cs.perGame.Tm,
        significance: milestone >= 7000 ? 'major' : 'notable',
        icon: EVENT_ICON_MAP.milestone,
      });
      nextAstIdx++;
    }

    // Check game milestones
    while (nextGamesIdx < GAME_MILESTONES.length && cumulGames >= GAME_MILESTONES[nextGamesIdx]) {
      const milestone = GAME_MILESTONES[nextGamesIdx];
      events.push({
        season: cs.season,
        year: parseSeasonYear(cs.season),
        type: 'milestone',
        title: `${formatNumber(milestone)} Career Games`,
        description: `Played in ${formatNumber(milestone)}th career game during the ${cs.season} season.`,
        team: cs.perGame.Tm,
        significance: milestone >= 1000 ? 'major' : 'minor',
        icon: EVENT_ICON_MAP.milestone,
      });
      nextGamesIdx++;
    }
  }

  return events;
}

// ── Peak Season Detection ───────────────────────────────────────────────────

function detectPeakSeason(
  seasons: readonly ConsolidatedSeason[],
): TimelineEvent | null {
  if (seasons.length < 2) return null;

  let bestSeason: ConsolidatedSeason | null = null;
  let bestScore = -Infinity;

  for (const cs of seasons) {
    if (num(cs.perGame.G) < 20) continue; // Need meaningful sample
    const adv = cs.advanced;
    // Prefer BPM, fall back to WS/48, fall back to PTS-based heuristic
    const score = adv
      ? (num(adv.BPM) !== 0 ? num(adv.BPM) : num(adv.WS48) * 10)
      : num(cs.perGame.PTS) * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestSeason = cs;
    }
  }

  if (!bestSeason) return null;

  const stats = buildSeasonStats(bestSeason.perGame, bestSeason.advanced);
  return {
    season: bestSeason.season,
    year: parseSeasonYear(bestSeason.season),
    type: 'peak_season',
    title: 'Statistical Peak',
    description: `Best statistical season in ${bestSeason.season}: ${stats.ppg} PPG, ${stats.rpg} RPG, ${stats.apg} APG${stats.bpm != null ? `, ${stats.bpm} BPM` : ''}.`,
    team: bestSeason.perGame.Tm,
    stats,
    significance: 'major',
    icon: EVENT_ICON_MAP.peak_season,
  };
}

// ── Season Events ───────────────────────────────────────────────────────────

function createSeasonEvents(
  seasons: readonly ConsolidatedSeason[],
): readonly TimelineEvent[] {
  return seasons.map((cs): TimelineEvent => {
    const stats = buildSeasonStats(cs.perGame, cs.advanced);
    const teamLabel = cs.perGame.Tm === 'TOT'
      ? cs.teamsPlayed.join('/')
      : cs.perGame.Tm;

    return {
      season: cs.season,
      year: parseSeasonYear(cs.season),
      type: 'season',
      title: `${cs.season} Season`,
      description: `${teamLabel}: ${stats.ppg} PPG, ${stats.rpg} RPG, ${stats.apg} APG in ${stats.games} games.`,
      team: cs.perGame.Tm,
      stats,
      significance: 'minor',
      icon: EVENT_ICON_MAP.season,
    };
  });
}

// ── Career Summary ──────────────────────────────────────────────────────────

function buildCareerSummary(
  seasons: readonly ConsolidatedSeason[],
  awards: readonly AwardRow[],
): CareerSummary {
  let totalPoints = 0;
  let totalGames = 0;
  let totalAssists = 0;
  let totalRebounds = 0;
  let bestScore = -Infinity;
  let peakSeason = '';
  const teamSet = new Set<string>();

  for (const cs of seasons) {
    const pg = cs.perGame;
    const games = num(pg.G);
    totalPoints += Math.round(games * num(pg.PTS));
    totalGames += games;
    totalAssists += Math.round(games * num(pg.AST));
    totalRebounds += Math.round(games * num(pg.TRB));

    // Collect unique teams (skip TOT)
    for (const t of cs.teamsPlayed) {
      if (t !== 'TOT') teamSet.add(t);
    }
    if (cs.perGame.Tm !== 'TOT') {
      teamSet.add(cs.perGame.Tm);
    }

    // Determine peak season by BPM or PTS
    const adv = cs.advanced;
    const score = adv ? num(adv.BPM) : num(pg.PTS) * 0.1;
    if (score > bestScore && num(pg.G) >= 20) {
      bestScore = score;
      peakSeason = cs.season;
    }
  }

  const firstYear = seasons.length > 0 ? parseSeasonYear(seasons[0].season) : 0;
  const lastYear = seasons.length > 0
    ? parseSeasonYear(seasons[seasons.length - 1].season) + 1
    : 0;

  return {
    totalPoints,
    totalGames,
    totalAssists,
    totalRebounds,
    peakSeason,
    teams: Array.from(teamSet),
    yearsActive: lastYear > firstYear ? lastYear - firstYear : 0,
    awardsCount: awards.length,
  };
}

// ── Main API ────────────────────────────────────────────────────────────────

export function buildTimeline(playerName: string): CareerTimeline | null {
  // Fetch all data
  const playerRow = fetchPlayerInfo(playerName);
  const perGame = fetchPerGameStats(playerName);

  if (perGame.length === 0) return null;

  const advanced = fetchAdvancedStats(playerName);
  const draftInfo = fetchDraftInfo(playerName);
  const awards = fetchAwards(playerName);

  // Consolidate seasons (handle TOT deduplication)
  const seasons = consolidateSeasons(perGame, advanced);

  // Build player info
  const playerInfo: PlayerInfo | null = playerRow
    ? {
        position: playerRow.Pos ?? '',
        height: playerRow.Height ?? '',
        college: playerRow.College ?? '',
        birthDate: playerRow.BirthDate ?? '',
        hof: num(playerRow.HOF),
        active: num(playerRow.Active),
        fromYear: num(playerRow.From),
        toYear: num(playerRow.To),
      }
    : null;

  // Generate all events
  const allEvents: TimelineEvent[] = [];

  // 1. Draft event
  if (draftInfo) {
    allEvents.push(createDraftEvent(draftInfo));
  }

  // 2. Rookie season
  if (seasons.length > 0) {
    allEvents.push(createRookieEvent(seasons[0]));
  }

  // 3. Award events
  for (const award of awards) {
    allEvents.push(createAwardEvent(award));
  }

  // 4. Trade detection
  allEvents.push(...detectTradeEvents(seasons));

  // 5. Career high detection
  allEvents.push(...detectCareerHighs(seasons));

  // 6. Milestone detection
  allEvents.push(...detectMilestones(seasons));

  // 7. Peak season
  const peakEvent = detectPeakSeason(seasons);
  if (peakEvent) {
    allEvents.push(peakEvent);
  }

  // 8. Season nodes
  allEvents.push(...createSeasonEvents(seasons));

  // Sort: by year ascending, then significance (major first)
  const sortedEvents = [...allEvents].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return significanceOrder(a.significance) - significanceOrder(b.significance);
  });

  // Build career summary
  const careerStats = buildCareerSummary(seasons, awards);

  return {
    player: playerName,
    playerInfo,
    events: sortedEvents,
    careerStats,
  };
}

export function getPlayerTimelineSummary(playerName: string): CareerSummary | null {
  const perGame = fetchPerGameStats(playerName);
  if (perGame.length === 0) return null;

  const advanced = fetchAdvancedStats(playerName);
  const awards = fetchAwards(playerName);
  const seasons = consolidateSeasons(perGame, advanced);

  return buildCareerSummary(seasons, awards);
}
