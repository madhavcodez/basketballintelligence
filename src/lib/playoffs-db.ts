import type Database from 'better-sqlite3';
import { getDb } from './db';

// ── Types ───────────────────────────────────────────────────────────────────

export type SeasonType = 'regular' | 'playoffs' | 'combined';

interface V2Result<T> {
  readonly data: readonly T[];
  readonly seasonType: SeasonType;
  readonly playoffAvailable: boolean;
}

interface PlayoffDataStatus {
  readonly hasPlayoffStats: boolean;
  readonly hasPlayoffAdvanced: boolean;
  readonly hasPlayoffShots: boolean;
  readonly playoffSeasons: readonly string[];
}

// ── Table allowlist ──────────────────────────────────────────────────────────

const ALLOWED_STATS_TABLES = {
  regular: 'player_stats_pergame',
  playoffs: 'player_stats_playoffs_pergame',
} as const;

const ALLOWED_ADVANCED_TABLES = {
  regular: 'player_stats_advanced',
  playoffs: 'player_stats_playoffs_advanced',
} as const;

const ALLOWED_STANDINGS_TABLES = {
  regular: 'standings',
  playoffs: 'standings_playoffs',
} as const;

type AllowedStatsTable = typeof ALLOWED_STATS_TABLES[keyof typeof ALLOWED_STATS_TABLES];
type AllowedAdvancedTable = typeof ALLOWED_ADVANCED_TABLES[keyof typeof ALLOWED_ADVANCED_TABLES];
type AllowedStandingsTable = typeof ALLOWED_STANDINGS_TABLES[keyof typeof ALLOWED_STANDINGS_TABLES];
type AllowedTable = AllowedStatsTable | AllowedAdvancedTable | AllowedStandingsTable;

function resolveStatsTable(seasonType: SeasonType, hasPlayoff: boolean): AllowedStatsTable {
  if (seasonType === 'playoffs' && hasPlayoff) return ALLOWED_STATS_TABLES.playoffs;
  return ALLOWED_STATS_TABLES.regular;
}

function resolveAdvancedTable(seasonType: SeasonType, hasPlayoff: boolean): AllowedAdvancedTable {
  if (seasonType === 'playoffs' && hasPlayoff) return ALLOWED_ADVANCED_TABLES.playoffs;
  return ALLOWED_ADVANCED_TABLES.regular;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?`
  ).get(tableName) as { count: number } | undefined;
  return (row?.count ?? 0) > 0;
}

export function parseSeasonType(raw: string | null): SeasonType {
  if (raw === 'playoffs' || raw === 'combined') return raw;
  return 'regular';
}

function clampLimit(value: string | number | undefined, defaultVal: number, max: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : (value ?? defaultVal);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

function clampOffset(value: string | number | undefined): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : (value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Get latest season from an allowlisted table. Only accepts known table names. */
function getLatestSeason(db: Database.Database, table: AllowedTable): string | undefined {
  const row = db.prepare(
    `SELECT MAX(Season) as s FROM "${table}"`
  ).get() as { s: string } | undefined;
  return row?.s || undefined;
}

/**
 * Safely query a table that may not exist.
 * Returns the rows on success or an empty array if the table is missing.
 */
function safeAll<T>(db: Database.Database, sql: string, params: readonly unknown[]): readonly T[] {
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch {
    return [];
  }
}

function safeGet<T>(db: Database.Database, sql: string, params: readonly unknown[]): T | undefined {
  try {
    return db.prepare(sql).get(...params) as T | undefined;
  } catch {
    return undefined;
  }
}

// ── Player Stats (per-game) ─────────────────────────────────────────────────

const STATS_COLUMNS = `
  Season as season, Tm as team, Pos as position, Age as age,
  G as games, GS as gamesStarted, MP as minutes,
  PTS as points, TRB as rebounds, AST as assists,
  STL as steals, BLK as blocks, TOV as turnovers,
  FG as fg, FGA as fga, FGPct as fgPct,
  "3P" as fg3, "3PA" as fg3a, "3PPct" as fg3Pct,
  "2P" as fg2, "2PA" as fg2a, "2PPct" as fg2Pct,
  FT as ft, FTA as fta, FTPct as ftPct,
  eFGPct as efgPct, ORB as orb, DRB as drb,
  PF as fouls, Awards as awards
`;

export function getPlayerStatsV2(name: string, seasonType: SeasonType): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_pergame');

  if (seasonType === 'regular') {
    const data = db.prepare(`
      SELECT ${STATS_COLUMNS}
      FROM player_stats_pergame
      WHERE Player = ?
      ORDER BY Season ASC
    `).all(name) as Record<string, unknown>[];
    return { data, seasonType, playoffAvailable: hasPlayoffTable };
  }

  if (seasonType === 'playoffs') {
    if (!hasPlayoffTable) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const data = safeAll<Record<string, unknown>>(db, `
      SELECT ${STATS_COLUMNS}
      FROM player_stats_playoffs_pergame
      WHERE Player = ?
      ORDER BY Season ASC
    `, [name]);
    return { data, seasonType, playoffAvailable: true };
  }

  // combined
  if (!hasPlayoffTable) {
    const data = db.prepare(`
      SELECT ${STATS_COLUMNS}
      FROM player_stats_pergame
      WHERE Player = ?
      ORDER BY Season ASC
    `).all(name) as Record<string, unknown>[];
    return { data, seasonType, playoffAvailable: false };
  }

  const data = db.prepare(`
    SELECT ${STATS_COLUMNS}, 'regular' as dataSource
    FROM player_stats_pergame
    WHERE Player = ?
    UNION ALL
    SELECT ${STATS_COLUMNS}, 'playoffs' as dataSource
    FROM player_stats_playoffs_pergame
    WHERE Player = ?
    ORDER BY season ASC
  `).all(name, name) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: true };
}

// ── Player Advanced Stats ───────────────────────────────────────────────────

const ADVANCED_COLUMNS = `
  Season as season, Tm as team, Age as age, G as games, MP as minutes,
  PER as per, TSPct as tsPct, "3PAr" as fg3ar, FTr as ftr,
  ORBPct as orbPct, DRBPct as drbPct, TRBPct as trbPct,
  ASTPct as astPct, STLPct as stlPct, BLKPct as blkPct,
  TOVPct as tovPct, USGPct as usgPct,
  OWS as ows, DWS as dws, WS as ws, WS48 as ws48,
  OBPM as obpm, DBPM as dbpm, BPM as bpm, VORP as vorp
`;

export function getPlayerAdvancedV2(name: string, seasonType: SeasonType): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_advanced');

  if (seasonType === 'regular') {
    const data = db.prepare(`
      SELECT ${ADVANCED_COLUMNS}
      FROM player_stats_advanced
      WHERE Player = ?
      ORDER BY Season ASC
    `).all(name) as Record<string, unknown>[];
    return { data, seasonType, playoffAvailable: hasPlayoffTable };
  }

  if (seasonType === 'playoffs') {
    if (!hasPlayoffTable) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const data = safeAll<Record<string, unknown>>(db, `
      SELECT ${ADVANCED_COLUMNS}
      FROM player_stats_playoffs_advanced
      WHERE Player = ?
      ORDER BY Season ASC
    `, [name]);
    return { data, seasonType, playoffAvailable: true };
  }

  // combined
  if (!hasPlayoffTable) {
    const data = db.prepare(`
      SELECT ${ADVANCED_COLUMNS}
      FROM player_stats_advanced
      WHERE Player = ?
      ORDER BY Season ASC
    `).all(name) as Record<string, unknown>[];
    return { data, seasonType, playoffAvailable: false };
  }

  const data = db.prepare(`
    SELECT ${ADVANCED_COLUMNS}, 'regular' as dataSource
    FROM player_stats_advanced
    WHERE Player = ?
    UNION ALL
    SELECT ${ADVANCED_COLUMNS}, 'playoffs' as dataSource
    FROM player_stats_playoffs_advanced
    WHERE Player = ?
    ORDER BY season ASC
  `).all(name, name) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: true };
}

// ── Player Shots ────────────────────────────────────────────────────────────

const SHOT_COLUMNS = `
  CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made,
  SHOT_ZONE_BASIC as zoneBasic, SHOT_ZONE_AREA as zoneArea,
  SHOT_ZONE_RANGE as zoneRange, SHOT_DISTANCE as distance,
  ACTION_TYPE as actionType, SHOT_TYPE as shotType,
  PERIOD as period, GAME_DATE as gameDate,
  TEAM_NAME as teamName, season
`;

export function getPlayerShotsV2(
  name: string,
  seasonType: SeasonType,
  season?: string,
  limit?: number,
  offset?: number,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const safeLimit = clampLimit(limit, 5000, 10000);
  const safeOffset = clampOffset(offset);
  const hasPlayoffShotsTable = tableExists(db, 'shots_playoffs');

  if (seasonType === 'playoffs') {
    if (!hasPlayoffShotsTable) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const whereClause = season
      ? 'WHERE PLAYER_NAME = ? AND season = ?'
      : 'WHERE PLAYER_NAME = ?';
    const params = season
      ? [name, season, safeLimit, safeOffset]
      : [name, safeLimit, safeOffset];
    const data = safeAll<Record<string, unknown>>(db, `
      SELECT ${SHOT_COLUMNS}
      FROM shots_playoffs ${whereClause}
      ORDER BY GAME_DATE DESC
      LIMIT ? OFFSET ?
    `, params);
    return { data, seasonType, playoffAvailable: true };
  }

  // 'regular' and 'combined' both query the existing shots table
  // (playoff shots can't be reliably distinguished in the current schema)
  const whereClause = season
    ? 'WHERE PLAYER_NAME = ? AND season = ?'
    : 'WHERE PLAYER_NAME = ?';
  const params = season
    ? [name, season, safeLimit, safeOffset]
    : [name, safeLimit, safeOffset];
  const data = db.prepare(`
    SELECT ${SHOT_COLUMNS}
    FROM shots ${whereClause}
    ORDER BY GAME_DATE DESC
    LIMIT ? OFFSET ?
  `).all(...params) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: hasPlayoffShotsTable };
}

// ── Shot Zone Stats ─────────────────────────────────────────────────────────

export function getShotZoneStatsV2(
  name: string,
  seasonType: SeasonType,
  season?: string,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffShotsTable = tableExists(db, 'shots_playoffs');

  const buildQuery = (table: string) => {
    const whereClause = season
      ? 'WHERE PLAYER_NAME = ? AND season = ?'
      : 'WHERE PLAYER_NAME = ?';
    const params = season ? [name, season] : [name];
    return { sql: `
      SELECT SHOT_ZONE_BASIC as zone, SHOT_ZONE_AREA as area,
             COUNT(*) as attempts,
             SUM(CAST(SHOT_MADE_FLAG as INTEGER)) as makes,
             ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG as INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
             ROUND(AVG(CAST(SHOT_DISTANCE as FLOAT)), 1) as avgDistance
      FROM "${table}" ${whereClause}
      GROUP BY SHOT_ZONE_BASIC, SHOT_ZONE_AREA
      ORDER BY attempts DESC
    `, params };
  };

  if (seasonType === 'playoffs') {
    if (!hasPlayoffShotsTable) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const { sql, params } = buildQuery('shots_playoffs');
    const data = safeAll<Record<string, unknown>>(db, sql, params);
    return { data, seasonType, playoffAvailable: true };
  }

  // 'regular' and 'combined' use main shots table
  const { sql, params } = buildQuery('shots');
  const data = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: hasPlayoffShotsTable };
}

// ── Similar Players ─────────────────────────────────────────────────────────

interface TargetStats {
  readonly pts: number;
  readonly trb: number;
  readonly ast: number;
  readonly stl: number;
  readonly blk: number;
  readonly mp: number;
}

export function findSimilarPlayersV2(
  name: string,
  seasonType: SeasonType,
  season?: string,
  limit?: number,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const safeLimit = clampLimit(limit, 5, 25);
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_pergame');
  const table = resolveStatsTable(seasonType, hasPlayoffTable);

  if (seasonType === 'playoffs' && !hasPlayoffTable) {
    return { data: [], seasonType, playoffAvailable: false };
  }

  const targetSeason = season || getLatestSeason(db, table) || '';

  const target = safeGet<TargetStats>(db, `
    SELECT CAST(PTS as FLOAT) as pts, CAST(TRB as FLOAT) as trb,
           CAST(AST as FLOAT) as ast, CAST(STL as FLOAT) as stl,
           CAST(BLK as FLOAT) as blk, CAST(MP as FLOAT) as mp
    FROM "${table}" WHERE Player = ? AND Season = ?
  `, [name, targetSeason]);

  if (!target) {
    return { data: [], seasonType, playoffAvailable: hasPlayoffTable };
  }

  const data = db.prepare(`
    SELECT Player as name, Tm as team, Season as season,
           CAST(PTS as FLOAT) as points, CAST(TRB as FLOAT) as rebounds,
           CAST(AST as FLOAT) as assists,
           ABS(CAST(PTS as FLOAT) - ?) + ABS(CAST(TRB as FLOAT) - ?) +
           ABS(CAST(AST as FLOAT) - ?) + ABS(CAST(STL as FLOAT) - ?) +
           ABS(CAST(BLK as FLOAT) - ?) as distance
    FROM "${table}"
    WHERE Player != ? AND Season = ? AND CAST(G as INTEGER) >= 20
    ORDER BY distance ASC
    LIMIT ?
  `).all(target.pts, target.trb, target.ast, target.stl, target.blk, name, targetSeason, safeLimit) as Record<string, unknown>[];

  return { data, seasonType, playoffAvailable: hasPlayoffTable };
}

// ── Compare Players ─────────────────────────────────────────────────────────

interface CompareResult {
  readonly player1: Record<string, unknown> | undefined;
  readonly player2: Record<string, unknown> | undefined;
  readonly seasonType: SeasonType;
  readonly playoffAvailable: boolean;
}

export function comparePlayersV2(
  p1: string,
  p2: string,
  seasonType: SeasonType,
  season?: string,
): CompareResult {
  const db = getDb();
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_pergame');
  const table = resolveStatsTable(seasonType, hasPlayoffTable);

  if (seasonType === 'playoffs' && !hasPlayoffTable) {
    return { player1: undefined, player2: undefined, seasonType, playoffAvailable: false };
  }

  const getStats = (name: string): Record<string, unknown> | undefined => {
    if (season) {
      return db.prepare(`
        SELECT Player as name, Season as season, Tm as team, Age as age,
               G as games, MP as minutes, PTS as points, TRB as rebounds,
               AST as assists, STL as steals, BLK as blocks, TOV as turnovers,
               FGPct as fgPct, "3PPct" as fg3Pct, FTPct as ftPct, eFGPct as efgPct
        FROM "${table}" WHERE Player = ? AND Season = ?
      `).get(name, season) as Record<string, unknown> | undefined;
    }
    return db.prepare(`
      SELECT Player as name, 'Career' as season,
             COUNT(DISTINCT Season) as seasons,
             ROUND(AVG(CAST(G as FLOAT)), 0) as games,
             ROUND(AVG(CAST(MP as FLOAT)), 1) as minutes,
             ROUND(AVG(CAST(PTS as FLOAT)), 1) as points,
             ROUND(AVG(CAST(TRB as FLOAT)), 1) as rebounds,
             ROUND(AVG(CAST(AST as FLOAT)), 1) as assists,
             ROUND(AVG(CAST(STL as FLOAT)), 1) as steals,
             ROUND(AVG(CAST(BLK as FLOAT)), 1) as blocks,
             ROUND(AVG(CAST(TOV as FLOAT)), 1) as turnovers,
             ROUND(AVG(CAST(FGPct as FLOAT)), 3) as fgPct,
             ROUND(AVG(CAST("3PPct" as FLOAT)), 3) as fg3Pct,
             ROUND(AVG(CAST(FTPct as FLOAT)), 3) as ftPct,
             ROUND(AVG(CAST(eFGPct as FLOAT)), 3) as efgPct
      FROM "${table}" WHERE Player = ?
    `).get(name) as Record<string, unknown> | undefined;
  };

  return {
    player1: getStats(p1),
    player2: getStats(p2),
    seasonType,
    playoffAvailable: hasPlayoffTable,
  };
}

// ── Team Roster ─────────────────────────────────────────────────────────────

export function getTeamRosterV2(
  abbr: string,
  seasonType: SeasonType,
  season?: string,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_pergame');
  const table = resolveStatsTable(seasonType, hasPlayoffTable);

  if (seasonType === 'playoffs' && !hasPlayoffTable) {
    return { data: [], seasonType, playoffAvailable: false };
  }

  const seasonFilter = season || getLatestSeason(db, table) || '';

  const data = db.prepare(`
    SELECT s.Player as name, s.Pos as position, s.Age as age, s.G as games,
           s.GS as gamesStarted, s.MP as minutes, s.PTS as points,
           s.TRB as rebounds, s.AST as assists, s.STL as steals, s.BLK as blocks,
           s.FGPct as fgPct, s."3PPct" as fg3Pct, s.FTPct as ftPct,
           p.person_id as personId
    FROM "${table}" s
    LEFT JOIN players p ON p.Player = s.Player
    WHERE s.Tm = ? AND s.Season = ?
    ORDER BY CAST(s.PTS as FLOAT) DESC
  `).all(abbr, seasonFilter) as Record<string, unknown>[];

  return { data, seasonType, playoffAvailable: hasPlayoffTable };
}

// ── Top Scorers ─────────────────────────────────────────────────────────────

export function getTopScorersV2(
  seasonType: SeasonType,
  season?: string,
  limit?: string | number,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const safeLimit = clampLimit(limit, 10, 100);
  const hasPlayoffTable = tableExists(db, 'player_stats_playoffs_pergame');
  const table = resolveStatsTable(seasonType, hasPlayoffTable);

  if (seasonType === 'playoffs' && !hasPlayoffTable) {
    return { data: [], seasonType, playoffAvailable: false };
  }

  const targetSeason = season || getLatestSeason(db, table) || '';

  const data = db.prepare(`
    SELECT s.Player as name, s.Tm as team, s.Pos as position,
           s.G as games, s.PTS as points, s.TRB as rebounds, s.AST as assists,
           s.FGPct as fgPct, s."3PPct" as fg3Pct,
           p.person_id as personId
    FROM "${table}" s
    LEFT JOIN players p ON p.Player = s.Player
    WHERE s.Season = ? AND CAST(s.G as INTEGER) >= 20
    ORDER BY CAST(s.PTS as FLOAT) DESC
    LIMIT ?
  `).all(targetSeason, safeLimit) as Record<string, unknown>[];

  return { data, seasonType, playoffAvailable: hasPlayoffTable };
}

// ── Lineups ─────────────────────────────────────────────────────────────────

export function getLineupsV2(
  teamAbbr: string,
  seasonType: SeasonType,
  season?: string,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffLineups = tableExists(db, 'lineups_playoffs');

  if (seasonType === 'playoffs') {
    if (!hasPlayoffLineups) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const whereClause = season
      ? 'WHERE TEAM_ABBREVIATION = ? AND season = ?'
      : 'WHERE TEAM_ABBREVIATION = ?';
    const params = season ? [teamAbbr, season] : [teamAbbr];
    const data = safeAll<Record<string, unknown>>(db, `
      SELECT GROUP_NAME as players, GP as gp, W as wins, L as losses,
             MIN as minutes, PTS as points, AST as assists, REB as rebounds,
             STL as steals, BLK as blocks, TOV as turnovers,
             FG_PCT as fgPct, FG3_PCT as fg3Pct, FT_PCT as ftPct,
             PLUS_MINUS as plusMinus, season
      FROM lineups_playoffs ${whereClause}
      ORDER BY CAST(MIN as FLOAT) DESC
      LIMIT 50
    `, params);
    return { data, seasonType, playoffAvailable: true };
  }

  // 'regular' and 'combined' use main lineups table
  const whereClause = season
    ? 'WHERE TEAM_ABBREVIATION = ? AND season = ?'
    : 'WHERE TEAM_ABBREVIATION = ?';
  const params = season ? [teamAbbr, season] : [teamAbbr];
  const data = db.prepare(`
    SELECT GROUP_NAME as players, GP as gp, W as wins, L as losses,
           MIN as minutes, PTS as points, AST as assists, REB as rebounds,
           STL as steals, BLK as blocks, TOV as turnovers,
           FG_PCT as fgPct, FG3_PCT as fg3Pct, FT_PCT as ftPct,
           PLUS_MINUS as plusMinus, season
    FROM lineups ${whereClause}
    ORDER BY CAST(MIN as FLOAT) DESC
    LIMIT 50
  `).all(...params) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: hasPlayoffLineups };
}

// ── Standings ───────────────────────────────────────────────────────────────

export function getStandingsV2(
  seasonType: SeasonType,
  season?: string,
): V2Result<Record<string, unknown>> {
  const db = getDb();
  const hasPlayoffStandings = tableExists(db, 'standings_playoffs');

  if (seasonType === 'playoffs') {
    if (!hasPlayoffStandings) {
      return { data: [], seasonType, playoffAvailable: false };
    }
    const targetSeason = season || getLatestSeason(db, 'standings_playoffs');
    const data = safeAll<Record<string, unknown>>(db, `
      SELECT Conference as conference, Rank as rank, Team as team,
             W as wins, L as losses, PCT as pct, GB as gb,
             PPG as ppg, OPP_PPG as oppPpg, DIFF as diff
      FROM standings_playoffs WHERE Season = ?
      ORDER BY Conference, CAST(Rank as INTEGER) ASC
    `, [targetSeason]);
    return { data, seasonType, playoffAvailable: true };
  }

  // 'regular' (and 'combined' — standings are inherently regular season)
  const targetSeason = season || getLatestSeason(db, 'standings');
  const data = db.prepare(`
    SELECT Conference as conference, Rank as rank, Team as team,
           W as wins, L as losses, PCT as pct, GB as gb,
           PPG as ppg, OPP_PPG as oppPpg, DIFF as diff
    FROM standings WHERE Season = ?
    ORDER BY Conference, CAST(Rank as INTEGER) ASC
  `).all(targetSeason) as Record<string, unknown>[];
  return { data, seasonType, playoffAvailable: hasPlayoffStandings };
}

// ── Playoff Data Status ─────────────────────────────────────────────────────

export function getPlayoffDataStatus(): PlayoffDataStatus {
  const db = getDb();

  const hasPlayoffStats = tableExists(db, 'player_stats_playoffs_pergame');
  const hasPlayoffAdvanced = tableExists(db, 'player_stats_playoffs_advanced');
  const hasPlayoffShots = tableExists(db, 'shots_playoffs');

  let playoffSeasons: readonly string[] = [];
  if (hasPlayoffStats) {
    const rows = safeAll<{ season: string }>(db, `
      SELECT DISTINCT Season as season
      FROM player_stats_playoffs_pergame
      ORDER BY Season DESC
    `, []);
    playoffSeasons = rows.map(r => r.season);
  }

  return { hasPlayoffStats, hasPlayoffAdvanced, hasPlayoffShots, playoffSeasons };
}
