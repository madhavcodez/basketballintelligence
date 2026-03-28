import { getDb } from './db';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface GameStats {
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

export interface MatchupGame {
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

export interface MatchupSummary {
  readonly player1: string;
  readonly player2: string;
  readonly totalGames: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly p1Averages: GameStats;
  readonly p2Averages: GameStats;
  readonly bestP1Game: MatchupGame | null;
  readonly bestP2Game: MatchupGame | null;
  readonly lastMeeting: MatchupGame | null;
  readonly headToHeadRecord: string;
}

export interface RivalRecord {
  readonly rival: string;
  readonly sharedGames: number;
  readonly wins: number;
  readonly losses: number;
}

export interface PopularMatchup {
  readonly player1: string;
  readonly player2: string;
  readonly slug: string;
}

// ── Raw row type from the JOIN query ────────────────────────────────────────

interface SharedGameRow {
  readonly GAME_ID: number;
  readonly GAME_DATE: string;
  readonly p1_TEAM_ABBREVIATION: string;
  readonly p2_TEAM_ABBREVIATION: string;
  readonly p1_WL: string | null;
  readonly p2_WL: string | null;
  readonly p1_MATCHUP: string | null;
  readonly p1_PTS: number | null;
  readonly p1_REB: number | null;
  readonly p1_AST: number | null;
  readonly p1_STL: number | null;
  readonly p1_BLK: number | null;
  readonly p1_FG_PCT: number | null;
  readonly p1_FG3_PCT: number | null;
  readonly p1_FT_PCT: number | null;
  readonly p1_MIN: number | null;
  readonly p1_PLUS_MINUS: number | null;
  readonly p1_FGM: number | null;
  readonly p1_FGA: number | null;
  readonly p1_FG3M: number | null;
  readonly p1_FG3A: number | null;
  readonly p1_FTM: number | null;
  readonly p1_FTA: number | null;
  readonly p1_TOV: number | null;
  readonly p2_PTS: number | null;
  readonly p2_REB: number | null;
  readonly p2_AST: number | null;
  readonly p2_STL: number | null;
  readonly p2_BLK: number | null;
  readonly p2_FG_PCT: number | null;
  readonly p2_FG3_PCT: number | null;
  readonly p2_FT_PCT: number | null;
  readonly p2_MIN: number | null;
  readonly p2_PLUS_MINUS: number | null;
  readonly p2_FGM: number | null;
  readonly p2_FGA: number | null;
  readonly p2_FG3M: number | null;
  readonly p2_FG3A: number | null;
  readonly p2_FTM: number | null;
  readonly p2_FTA: number | null;
  readonly p2_TOV: number | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeNum(value: number | null | undefined): number {
  return value ?? 0;
}

function buildGameStats(
  pts: number | null,
  reb: number | null,
  ast: number | null,
  stl: number | null,
  blk: number | null,
  fgPct: number | null,
  fg3Pct: number | null,
  ftPct: number | null,
  min: number | null,
  plusMinus: number | null,
  fgm: number | null,
  fga: number | null,
  fg3m: number | null,
  fg3a: number | null,
  ftm: number | null,
  fta: number | null,
  tov: number | null,
): GameStats {
  return {
    pts: safeNum(pts),
    reb: safeNum(reb),
    ast: safeNum(ast),
    stl: safeNum(stl),
    blk: safeNum(blk),
    fgPct: safeNum(fgPct),
    fg3Pct: safeNum(fg3Pct),
    ftPct: safeNum(ftPct),
    min: safeNum(min),
    plusMinus: safeNum(plusMinus),
    fgm: safeNum(fgm),
    fga: safeNum(fga),
    fg3m: safeNum(fg3m),
    fg3a: safeNum(fg3a),
    ftm: safeNum(ftm),
    fta: safeNum(fta),
    tov: safeNum(tov),
  };
}

function rowToMatchupGame(row: SharedGameRow): MatchupGame {
  return {
    gameId: row.GAME_ID,
    gameDate: row.GAME_DATE,
    p1Team: row.p1_TEAM_ABBREVIATION,
    p2Team: row.p2_TEAM_ABBREVIATION,
    p1Won: row.p1_WL === 'W',
    p2Won: row.p2_WL === 'W',
    matchupStr: row.p1_MATCHUP ?? `${row.p1_TEAM_ABBREVIATION} vs. ${row.p2_TEAM_ABBREVIATION}`,
    p1Stats: buildGameStats(
      row.p1_PTS, row.p1_REB, row.p1_AST, row.p1_STL, row.p1_BLK,
      row.p1_FG_PCT, row.p1_FG3_PCT, row.p1_FT_PCT, row.p1_MIN,
      row.p1_PLUS_MINUS, row.p1_FGM, row.p1_FGA, row.p1_FG3M,
      row.p1_FG3A, row.p1_FTM, row.p1_FTA, row.p1_TOV,
    ),
    p2Stats: buildGameStats(
      row.p2_PTS, row.p2_REB, row.p2_AST, row.p2_STL, row.p2_BLK,
      row.p2_FG_PCT, row.p2_FG3_PCT, row.p2_FT_PCT, row.p2_MIN,
      row.p2_PLUS_MINUS, row.p2_FGM, row.p2_FGA, row.p2_FG3M,
      row.p2_FG3A, row.p2_FTM, row.p2_FTA, row.p2_TOV,
    ),
  };
}

function computeAverages(statsArray: readonly GameStats[]): GameStats {
  const count = statsArray.length;
  if (count === 0) {
    return buildGameStats(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }

  const sum = statsArray.reduce(
    (acc, s) => ({
      pts: acc.pts + s.pts,
      reb: acc.reb + s.reb,
      ast: acc.ast + s.ast,
      stl: acc.stl + s.stl,
      blk: acc.blk + s.blk,
      fgPct: acc.fgPct + s.fgPct,
      fg3Pct: acc.fg3Pct + s.fg3Pct,
      ftPct: acc.ftPct + s.ftPct,
      min: acc.min + s.min,
      plusMinus: acc.plusMinus + s.plusMinus,
      fgm: acc.fgm + s.fgm,
      fga: acc.fga + s.fga,
      fg3m: acc.fg3m + s.fg3m,
      fg3a: acc.fg3a + s.fg3a,
      ftm: acc.ftm + s.ftm,
      fta: acc.fta + s.fta,
      tov: acc.tov + s.tov,
    }),
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, min: 0, plusMinus: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, tov: 0 },
  );

  return {
    pts: sum.pts / count,
    reb: sum.reb / count,
    ast: sum.ast / count,
    stl: sum.stl / count,
    blk: sum.blk / count,
    fgPct: sum.fgPct / count,
    fg3Pct: sum.fg3Pct / count,
    ftPct: sum.ftPct / count,
    min: sum.min / count,
    plusMinus: sum.plusMinus / count,
    fgm: sum.fgm / count,
    fga: sum.fga / count,
    fg3m: sum.fg3m / count,
    fg3a: sum.fg3a / count,
    ftm: sum.ftm / count,
    fta: sum.fta / count,
    tov: sum.tov / count,
  };
}

// ── Shared Games Query ──────────────────────────────────────────────────────

const SHARED_GAMES_SQL = `
  SELECT
    p1.gameid AS GAME_ID,
    p1.game_date AS GAME_DATE,
    p1.teamtricode AS p1_TEAM_ABBREVIATION,
    p2.teamtricode AS p2_TEAM_ABBREVIATION,
    CASE WHEN CAST(p1.plusminuspoints AS REAL) > 0 THEN 'W' ELSE 'L' END AS p1_WL,
    CASE WHEN CAST(p2.plusminuspoints AS REAL) > 0 THEN 'W' ELSE 'L' END AS p2_WL,
    p1.matchup AS p1_MATCHUP,
    CAST(p1.points AS REAL) AS p1_PTS,
    CAST(p1.reboundstotal AS REAL) AS p1_REB,
    CAST(p1.assists AS REAL) AS p1_AST,
    CAST(p1.steals AS REAL) AS p1_STL,
    CAST(p1.blocks AS REAL) AS p1_BLK,
    CAST(p1.fieldgoalspercentage AS REAL) AS p1_FG_PCT,
    CAST(p1.threepointerspercentage AS REAL) AS p1_FG3_PCT,
    CAST(p1.freethrowspercentage AS REAL) AS p1_FT_PCT,
    CAST(p1.minutes AS REAL) AS p1_MIN,
    CAST(p1.plusminuspoints AS REAL) AS p1_PLUS_MINUS,
    CAST(p1.fieldgoalsmade AS REAL) AS p1_FGM,
    CAST(p1.fieldgoalsattempted AS REAL) AS p1_FGA,
    CAST(p1.threepointersmade AS REAL) AS p1_FG3M,
    CAST(p1.threepointersattempted AS REAL) AS p1_FG3A,
    CAST(p1.freethrowsmade AS REAL) AS p1_FTM,
    CAST(p1.freethrowsattempted AS REAL) AS p1_FTA,
    CAST(p1.turnovers AS REAL) AS p1_TOV,
    CAST(p2.points AS REAL) AS p2_PTS,
    CAST(p2.reboundstotal AS REAL) AS p2_REB,
    CAST(p2.assists AS REAL) AS p2_AST,
    CAST(p2.steals AS REAL) AS p2_STL,
    CAST(p2.blocks AS REAL) AS p2_BLK,
    CAST(p2.fieldgoalspercentage AS REAL) AS p2_FG_PCT,
    CAST(p2.threepointerspercentage AS REAL) AS p2_FG3_PCT,
    CAST(p2.freethrowspercentage AS REAL) AS p2_FT_PCT,
    CAST(p2.minutes AS REAL) AS p2_MIN,
    CAST(p2.plusminuspoints AS REAL) AS p2_PLUS_MINUS,
    CAST(p2.fieldgoalsmade AS REAL) AS p2_FGM,
    CAST(p2.fieldgoalsattempted AS REAL) AS p2_FGA,
    CAST(p2.threepointersmade AS REAL) AS p2_FG3M,
    CAST(p2.threepointersattempted AS REAL) AS p2_FG3A,
    CAST(p2.freethrowsmade AS REAL) AS p2_FTM,
    CAST(p2.freethrowsattempted AS REAL) AS p2_FTA,
    CAST(p2.turnovers AS REAL) AS p2_TOV
  FROM player_game_logs p1
  INNER JOIN player_game_logs p2
    ON p1.gameid = p2.gameid
  WHERE p1.personname = ?
    AND p2.personname = ?
    AND p1.teamtricode != p2.teamtricode
  ORDER BY p1.game_date DESC
` as const;

export function getSharedGames(player1: string, player2: string): MatchupGame[] {
  const db = getDb();
  const rows = db.prepare(SHARED_GAMES_SQL).all(player1, player2) as SharedGameRow[];
  return rows.map(rowToMatchupGame);
}

// ── Matchup Summary ─────────────────────────────────────────────────────────

function buildHeadToHeadRecord(
  player1: string,
  player2: string,
  p1Wins: number,
  p2Wins: number,
): string {
  const p1First = player1.split(' ').pop() ?? player1;
  const p2First = player2.split(' ').pop() ?? player2;

  if (p1Wins === p2Wins) {
    return `Series tied ${p1Wins}-${p2Wins}`;
  }

  return p1Wins > p2Wins
    ? `${p1First} leads ${p1Wins}-${p2Wins}`
    : `${p2First} leads ${p2Wins}-${p1Wins}`;
}

export function getMatchupSummary(player1: string, player2: string): MatchupSummary | null {
  const games = getSharedGames(player1, player2);

  if (games.length === 0) {
    return null;
  }

  const p1Wins = games.filter((g) => g.p1Won).length;
  const p2Wins = games.filter((g) => g.p2Won).length;

  const p1StatsArray = games.map((g) => g.p1Stats);
  const p2StatsArray = games.map((g) => g.p2Stats);

  const bestP1Game = games.reduce<MatchupGame | null>(
    (best, g) => (best === null || g.p1Stats.pts > best.p1Stats.pts ? g : best),
    null,
  );

  const bestP2Game = games.reduce<MatchupGame | null>(
    (best, g) => (best === null || g.p2Stats.pts > best.p2Stats.pts ? g : best),
    null,
  );

  const lastMeeting = games[0] ?? null; // already sorted DESC by date

  return {
    player1,
    player2,
    totalGames: games.length,
    p1Wins,
    p2Wins,
    p1Averages: computeAverages(p1StatsArray),
    p2Averages: computeAverages(p2StatsArray),
    bestP1Game,
    bestP2Game,
    lastMeeting,
    headToHeadRecord: buildHeadToHeadRecord(player1, player2, p1Wins, p2Wins),
  };
}

// ── Top Rivals ──────────────────────────────────────────────────────────────

interface RivalRow {
  readonly rival: string;
  readonly sharedGames: number;
  readonly wins: number;
  readonly losses: number;
}

const TOP_RIVALS_SQL = `
  SELECT
    p2.personname AS rival,
    COUNT(*) AS sharedGames,
    SUM(CASE WHEN CAST(p1.plusminuspoints AS REAL) > 0 THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN CAST(p1.plusminuspoints AS REAL) <= 0 THEN 1 ELSE 0 END) AS losses
  FROM player_game_logs p1
  INNER JOIN player_game_logs p2
    ON p1.gameid = p2.gameid
  WHERE p1.personname = ?
    AND p1.teamtricode != p2.teamtricode
    AND p2.personname != p1.personname
  GROUP BY p2.personname
  ORDER BY sharedGames DESC
  LIMIT ?
` as const;

export function getTopRivals(playerName: string, limit: number = 10): RivalRecord[] {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const rows = db.prepare(TOP_RIVALS_SQL).all(playerName, safeLimit) as RivalRow[];

  return rows.map((row) => ({
    rival: row.rival,
    sharedGames: row.sharedGames,
    wins: row.wins,
    losses: row.losses,
  }));
}

// ── Player Name Search ──────────────────────────────────────────────────────

interface PlayerNameRow {
  readonly personname: string;
}

export function findPlayerName(query: string): string | null {
  const db = getDb();
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // Try exact match first
  const exact = db.prepare(
    `SELECT DISTINCT personname FROM player_game_logs WHERE personname = ? LIMIT 1`
  ).get(trimmed) as PlayerNameRow | undefined;

  if (exact) {
    return exact.personname;
  }

  // Try LIKE match with the query as a prefix
  const prefixMatch = db.prepare(
    `SELECT DISTINCT personname FROM player_game_logs WHERE personname LIKE ? ORDER BY personname ASC LIMIT 1`
  ).get(`${trimmed}%`) as PlayerNameRow | undefined;

  if (prefixMatch) {
    return prefixMatch.personname;
  }

  // Try LIKE match with query anywhere in the name
  const containsMatch = db.prepare(
    `SELECT DISTINCT personname FROM player_game_logs WHERE personname LIKE ? ORDER BY personname ASC LIMIT 1`
  ).get(`%${trimmed}%`) as PlayerNameRow | undefined;

  return containsMatch?.personname ?? null;
}

// ── Slug Helpers ────────────────────────────────────────────────────────────

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.]/g, '')         // strip apostrophes and periods
    .replace(/\s+/g, '-')         // spaces to hyphens
    .replace(/[^a-z0-9-]/g, '')   // strip non-alphanumeric except hyphens
    .replace(/-+/g, '-')          // collapse multiple hyphens
    .replace(/^-|-$/g, '');       // trim leading/trailing hyphens
}

function deslugifyName(slug: string): string {
  return slug
    .split('-')
    .map((word) => {
      // Preserve Roman numerals (II, III, IV, etc.)
      if (/^(i{2,3}|iv|vi{0,3}|ix|xi{0,3})$/i.test(word)) {
        return word.toUpperCase();
      }
      // Preserve suffixes like "Jr" and "Sr"
      if (/^(jr|sr)$/i.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + '.';
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function toMatchupSlug(player1: string, player2: string): string {
  return `${slugifyName(player1)}-vs-${slugifyName(player2)}`;
}

export function fromMatchupSlug(slug: string): { player1: string; player2: string } | null {
  const parts = slug.split('-vs-');

  if (parts.length !== 2) {
    return null;
  }

  return {
    player1: deslugifyName(parts[0]),
    player2: deslugifyName(parts[1]),
  };
}

// ── Popular Matchups ────────────────────────────────────────────────────────

const POPULAR_MATCHUPS: readonly PopularMatchup[] = [
  {
    player1: 'LeBron James',
    player2: 'Stephen Curry',
    slug: toMatchupSlug('LeBron James', 'Stephen Curry'),
  },
  {
    player1: 'LeBron James',
    player2: 'Kevin Durant',
    slug: toMatchupSlug('LeBron James', 'Kevin Durant'),
  },
  {
    player1: 'Stephen Curry',
    player2: 'Kevin Durant',
    slug: toMatchupSlug('Stephen Curry', 'Kevin Durant'),
  },
  {
    player1: 'Nikola Jokic',
    player2: 'Joel Embiid',
    slug: toMatchupSlug('Nikola Jokic', 'Joel Embiid'),
  },
  {
    player1: 'Giannis Antetokounmpo',
    player2: 'Joel Embiid',
    slug: toMatchupSlug('Giannis Antetokounmpo', 'Joel Embiid'),
  },
  {
    player1: 'Luka Doncic',
    player2: 'Jayson Tatum',
    slug: toMatchupSlug('Luka Doncic', 'Jayson Tatum'),
  },
] as const;

export function getPopularMatchups(): PopularMatchup[] {
  return [...POPULAR_MATCHUPS];
}
