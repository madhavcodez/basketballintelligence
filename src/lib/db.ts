import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'basketball.db');
    db = new Database(dbPath, { readonly: true });
    db.pragma('cache_size = -65536'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 536870912'); // 512MB mmap
  }
  return db;
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

// Player queries
export function searchPlayers(query: string, limit: number | string = 20, offset: number | string = 0) {
  const db = getDb();
  const safeLimit = clampLimit(limit, 20, 100);
  const safeOffset = clampOffset(offset);
  return db.prepare(`
    SELECT DISTINCT p.rowid as id, p.Player as name, p.Pos as position,
           p.Height as height, p.Weight as weight, p.College as college,
           p.BirthDate as birthDate, p.HOF as hof, p.Active as active,
           p."From" as fromYear, p."To" as toYear
    FROM players p
    WHERE p.Player LIKE ?
    ORDER BY p.Active DESC, p.Player ASC
    LIMIT ? OFFSET ?
  `).all(`%${query}%`, safeLimit, safeOffset);
}

export function getPlayer(name: string) {
  const db = getDb();
  const player = db.prepare(`
    SELECT rowid as id, Player as name, Pos as position, Height as height,
           Weight as weight, College as college, BirthDate as birthDate,
           HOF as hof, Active as active, "From" as fromYear, "To" as toYear
    FROM players WHERE Player = ?
  `).get(name);
  return player;
}

export function getPlayerStats(playerName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT Season as season, Tm as team, Pos as position, Age as age,
           G as games, GS as gamesStarted, MP as minutes,
           PTS as points, TRB as rebounds, AST as assists,
           STL as steals, BLK as blocks, TOV as turnovers,
           FG as fg, FGA as fga, FGPct as fgPct,
           "3P" as fg3, "3PA" as fg3a, "3PPct" as fg3Pct,
           "2P" as fg2, "2PA" as fg2a, "2PPct" as fg2Pct,
           FT as ft, FTA as fta, FTPct as ftPct,
           eFGPct as efgPct, ORB as orb, DRB as drb,
           PF as fouls, Awards as awards
    FROM player_stats_pergame
    WHERE Player = ?
    ORDER BY Season ASC
  `).all(playerName);
}

export function getPlayerAdvanced(playerName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT Season as season, Tm as team, Age as age, G as games, MP as minutes,
           PER as per, TSPct as tsPct, "3PAr" as fg3ar, FTr as ftr,
           ORBPct as orbPct, DRBPct as drbPct, TRBPct as trbPct,
           ASTPct as astPct, STLPct as stlPct, BLKPct as blkPct,
           TOVPct as tovPct, USGPct as usgPct,
           OWS as ows, DWS as dws, WS as ws, WS48 as ws48,
           OBPM as obpm, DBPM as dbpm, BPM as bpm, VORP as vorp
    FROM player_stats_advanced
    WHERE Player = ?
    ORDER BY Season ASC
  `).all(playerName);
}

export function getPlayerShots(playerName: string, season?: string, limit: number | string = 5000, offset: number | string = 0) {
  const db = getDb();
  const safeLimit = clampLimit(limit, 5000, 10000);
  const safeOffset = clampOffset(offset);
  if (season) {
    return db.prepare(`
      SELECT LOC_X as x, LOC_Y as y, SHOT_MADE_FLAG as made,
             SHOT_ZONE_BASIC as zoneBasic, SHOT_ZONE_AREA as zoneArea,
             SHOT_ZONE_RANGE as zoneRange, SHOT_DISTANCE as distance,
             ACTION_TYPE as actionType, SHOT_TYPE as shotType,
             PERIOD as period, GAME_DATE as gameDate,
             TEAM_NAME as teamName, season
      FROM shots WHERE PLAYER_NAME = ? AND season = ?
      ORDER BY GAME_DATE DESC
      LIMIT ? OFFSET ?
    `).all(playerName, season, safeLimit, safeOffset);
  }
  return db.prepare(`
    SELECT LOC_X as x, LOC_Y as y, SHOT_MADE_FLAG as made,
           SHOT_ZONE_BASIC as zoneBasic, SHOT_ZONE_AREA as zoneArea,
           SHOT_ZONE_RANGE as zoneRange, SHOT_DISTANCE as distance,
           ACTION_TYPE as actionType, SHOT_TYPE as shotType,
           PERIOD as period, GAME_DATE as gameDate,
           TEAM_NAME as teamName, season
    FROM shots WHERE PLAYER_NAME = ?
    ORDER BY GAME_DATE DESC
    LIMIT ? OFFSET ?
  `).all(playerName, safeLimit, safeOffset);
}

export function getPlayerShotSeasons(playerName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT season FROM shots WHERE PLAYER_NAME = ? ORDER BY season DESC
  `).all(playerName);
}

export function getShotZoneStats(playerName: string, season?: string) {
  const db = getDb();
  const whereClause = season
    ? 'WHERE PLAYER_NAME = ? AND season = ?'
    : 'WHERE PLAYER_NAME = ?';
  const params = season ? [playerName, season] : [playerName];
  return db.prepare(`
    SELECT SHOT_ZONE_BASIC as zone, SHOT_ZONE_AREA as area,
           COUNT(*) as attempts,
           SUM(CAST(SHOT_MADE_FLAG as INTEGER)) as makes,
           ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG as INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
           ROUND(AVG(CAST(SHOT_DISTANCE as FLOAT)), 1) as avgDistance
    FROM shots ${whereClause}
    GROUP BY SHOT_ZONE_BASIC, SHOT_ZONE_AREA
    ORDER BY attempts DESC
  `).all(...params);
}

// Team queries
export function getTeams() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT TEAM_ABBREVIATION as abbr, TEAM_NAME as name, TEAM_ID as teamId
    FROM team_game_logs
    WHERE SEASON_ID = (SELECT MAX(SEASON_ID) FROM team_game_logs)
    ORDER BY TEAM_NAME ASC
  `).all();
}

export function getTeamStats(teamAbbr: string) {
  const db = getDb();
  return db.prepare(`
    SELECT SEASON_ID as seasonId, TEAM_NAME as teamName,
           COUNT(*) as games,
           SUM(CASE WHEN WL = 'W' THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN WL = 'L' THEN 1 ELSE 0 END) as losses,
           ROUND(AVG(CAST(PTS as FLOAT)), 1) as ppg,
           ROUND(AVG(CAST(REB as FLOAT)), 1) as rpg,
           ROUND(AVG(CAST(AST as FLOAT)), 1) as apg,
           ROUND(AVG(CAST(STL as FLOAT)), 1) as spg,
           ROUND(AVG(CAST(BLK as FLOAT)), 1) as bpg,
           ROUND(AVG(CAST(FG_PCT as FLOAT)) * 100, 1) as fgPct,
           ROUND(AVG(CAST(FG3_PCT as FLOAT)) * 100, 1) as fg3Pct,
           ROUND(AVG(CAST(FT_PCT as FLOAT)) * 100, 1) as ftPct
    FROM team_game_logs
    WHERE TEAM_ABBREVIATION = ?
    GROUP BY SEASON_ID
    ORDER BY SEASON_ID DESC
  `).all(teamAbbr);
}

export function getTeamAdvanced(teamName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT Season as season, TEAM_NAME as teamName, GP as gp, W as wins, L as losses,
           OFF_RATING as offRating, DEF_RATING as defRating, NET_RATING as netRating,
           PACE as pace, TS_PCT as tsPct, EFG_PCT as efgPct,
           AST_PCT as astPct, OREB_PCT as orebPct, DREB_PCT as drebPct,
           TM_TOV_PCT as tovPct, PIE as pie
    FROM team_stats_advanced
    WHERE TEAM_NAME = ?
    ORDER BY Season DESC
  `).all(teamName);
}

export function getTeamRoster(teamAbbr: string, season?: string) {
  const db = getDb();
  const seasonFilter = season || (db.prepare(
    `SELECT MAX(Season) as s FROM player_stats_pergame`
  ).get() as { s: string })?.s;
  return db.prepare(`
    SELECT Player as name, Pos as position, Age as age, G as games,
           GS as gamesStarted, MP as minutes, PTS as points,
           TRB as rebounds, AST as assists, STL as steals, BLK as blocks,
           FGPct as fgPct, "3PPct" as fg3Pct, FTPct as ftPct
    FROM player_stats_pergame
    WHERE Tm = ? AND Season = ?
    ORDER BY CAST(PTS as FLOAT) DESC
  `).all(teamAbbr, seasonFilter);
}

// Lineup queries
export function getLineups(teamAbbr: string, season?: string) {
  const db = getDb();
  const whereClause = season
    ? 'WHERE TEAM_ABBREVIATION = ? AND season = ?'
    : 'WHERE TEAM_ABBREVIATION = ?';
  const params = season ? [teamAbbr, season] : [teamAbbr];
  return db.prepare(`
    SELECT GROUP_NAME as players, GP as gp, W as wins, L as losses,
           MIN as minutes, PTS as points, AST as assists, REB as rebounds,
           STL as steals, BLK as blocks, TOV as turnovers,
           FG_PCT as fgPct, FG3_PCT as fg3Pct, FT_PCT as ftPct,
           PLUS_MINUS as plusMinus, season
    FROM lineups ${whereClause}
    ORDER BY CAST(MIN as FLOAT) DESC
    LIMIT 50
  `).all(...params);
}

// Compare queries
export function comparePlayers(name1: string, name2: string, season?: string) {
  const db = getDb();
  const getStats = (name: string) => {
    if (season) {
      return db.prepare(`
        SELECT Player as name, Season as season, Tm as team, Age as age,
               G as games, MP as minutes, PTS as points, TRB as rebounds,
               AST as assists, STL as steals, BLK as blocks, TOV as turnovers,
               FGPct as fgPct, "3PPct" as fg3Pct, FTPct as ftPct, eFGPct as efgPct
        FROM player_stats_pergame WHERE Player = ? AND Season = ?
      `).get(name, season);
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
      FROM player_stats_pergame WHERE Player = ?
    `).get(name);
  };
  return { player1: getStats(name1), player2: getStats(name2) };
}

// Awards queries
export function getPlayerAwards(playerName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT award_type as awardType, Season as season, Tm as team
    FROM awards WHERE Player = ?
    ORDER BY Season DESC
  `).all(playerName);
}

// Draft queries
export function getDraftPick(playerName: string) {
  const db = getDb();
  return db.prepare(`
    SELECT Year as year, Rk as round, Pk as pick, Tm as team, College as college
    FROM draft WHERE Player = ?
  `).get(playerName);
}

// Explore/homepage queries
export function getFeaturedPlayers(limit = 12) {
  const db = getDb();
  return db.prepare(`
    SELECT p.Player as name, p.Pos as position, p.Active as active,
           s.Season as season, s.Tm as team, s.PTS as points, s.TRB as rebounds,
           s.AST as assists, s.G as games
    FROM players p
    JOIN player_stats_pergame s ON p.Player = s.Player
    WHERE s.Season = (SELECT MAX(Season) FROM player_stats_pergame)
    ORDER BY CAST(s.PTS as FLOAT) DESC
    LIMIT ?
  `).all(limit);
}

export function getTopScorers(season?: string, limit = 10) {
  const db = getDb();
  const targetSeason = season || (db.prepare(
    `SELECT MAX(Season) as s FROM player_stats_pergame`
  ).get() as { s: string })?.s;
  return db.prepare(`
    SELECT Player as name, Tm as team, Pos as position,
           G as games, PTS as points, TRB as rebounds, AST as assists,
           FGPct as fgPct, "3PPct" as fg3Pct
    FROM player_stats_pergame
    WHERE Season = ? AND CAST(G as INTEGER) >= 20
    ORDER BY CAST(PTS as FLOAT) DESC
    LIMIT ?
  `).all(targetSeason, limit);
}

export function getSeasons() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT Season as season FROM player_stats_pergame ORDER BY Season DESC
  `).all();
}

export function getDataEdition() {
  const db = getDb();
  const shotCount = (db.prepare('SELECT COUNT(*) as c FROM shots').get() as { c: number })?.c || 0;
  const playerCount = (db.prepare('SELECT COUNT(*) as c FROM players').get() as { c: number })?.c || 0;
  const seasonRange = db.prepare(`
    SELECT MIN(Season) as earliest, MAX(Season) as latest FROM player_stats_pergame
  `).get() as { earliest: string; latest: string };
  return {
    shotCount,
    playerCount,
    earliestSeason: seasonRange?.earliest,
    latestSeason: seasonRange?.latest,
    edition: 'March 2026',
    lastUpdated: '2026-03-23'
  };
}

// Percentile calculation for player context
export function getPercentiles(season: string, stat: string) {
  const db = getDb();
  const validStats: Record<string, string> = {
    points: 'PTS', rebounds: 'TRB', assists: 'AST', steals: 'STL',
    blocks: 'BLK', fgPct: 'FGPct', fg3Pct: '"3PPct"', ftPct: 'FTPct',
    minutes: 'MP', games: 'G'
  };
  const col = validStats[stat];
  if (!col) return [];
  return db.prepare(`
    SELECT Player as name, CAST(${col} as FLOAT) as value
    FROM player_stats_pergame
    WHERE Season = ? AND CAST(G as INTEGER) >= 20
    ORDER BY value ASC
  `).all(season);
}

// Similar players by stat profile
export function findSimilarPlayers(playerName: string, season: string, limit = 5) {
  const db = getDb();
  const target = db.prepare(`
    SELECT CAST(PTS as FLOAT) as pts, CAST(TRB as FLOAT) as trb,
           CAST(AST as FLOAT) as ast, CAST(STL as FLOAT) as stl,
           CAST(BLK as FLOAT) as blk, CAST(MP as FLOAT) as mp
    FROM player_stats_pergame WHERE Player = ? AND Season = ?
  `).get(playerName, season) as { pts: number; trb: number; ast: number; stl: number; blk: number; mp: number } | undefined;

  if (!target) return [];

  return db.prepare(`
    SELECT Player as name, Tm as team, Season as season,
           CAST(PTS as FLOAT) as points, CAST(TRB as FLOAT) as rebounds,
           CAST(AST as FLOAT) as assists,
           ABS(CAST(PTS as FLOAT) - ?) + ABS(CAST(TRB as FLOAT) - ?) +
           ABS(CAST(AST as FLOAT) - ?) + ABS(CAST(STL as FLOAT) - ?) +
           ABS(CAST(BLK as FLOAT) - ?) as distance
    FROM player_stats_pergame
    WHERE Player != ? AND Season = ? AND CAST(G as INTEGER) >= 20
    ORDER BY distance ASC
    LIMIT ?
  `).all(target.pts, target.trb, target.ast, target.stl, target.blk, playerName, season, limit);
}

// Career leaders
export function getCareerLeaders(stat: string, limit: number | string = 25, league = 'nba') {
  const db = getDb();
  const safeLimit = clampLimit(limit, 25, 100);
  return db.prepare(`
    SELECT CAST(Rank as REAL) as rank, Player as name, HOF as hof, Active as active,
           Value as value
    FROM career_leaders
    WHERE stat = ? AND league = ? AND Rank IS NOT NULL AND TRIM(Rank) != ''
    ORDER BY CAST(Rank as REAL) ASC
    LIMIT ?
  `).all(stat, league, safeLimit);
}

// Standings
export function getStandings(season?: string) {
  const db = getDb();
  const targetSeason = season || (db.prepare(
    `SELECT MAX(Season) as s FROM standings`
  ).get() as { s: string })?.s;
  return db.prepare(`
    SELECT Conference as conference, Rank as rank, Team as team,
           W as wins, L as losses, PCT as pct, GB as gb,
           PPG as ppg, OPP_PPG as oppPpg, DIFF as diff
    FROM standings WHERE Season = ?
    ORDER BY Conference, CAST(Rank as INTEGER) ASC
  `).all(targetSeason);
}

// ── Quiz / Play Mode ──────────────────────────────────────────────────────────

/** Difficulty presets for Guess the Player */
const GUESS_DIFFICULTY = {
  easy: {
    minGames: 60,
    minPts: 22,
    seasonFilter: "AND CAST(Season as INTEGER) >= 2000",
  },
  medium: {
    minGames: 40,
    minPts: 15,
    seasonFilter: "",
  },
  hard: {
    minGames: 20,
    minPts: 8,
    seasonFilter: "",
  },
} as const;

export type QuizDifficulty = keyof typeof GUESS_DIFFICULTY;

/** Guess the Player — returns a single player row, filtered by difficulty. */
export function getPlayerForQuizByDifficulty(difficulty: QuizDifficulty = 'medium') {
  const db = getDb();
  const cfg = GUESS_DIFFICULTY[difficulty];
  return db.prepare(`
    SELECT Player as name, Tm as team, Season as season,
           PTS as points, TRB as rebounds, AST as assists,
           STL as steals, BLK as blocks, G as games,
           FGPct as fgPct, "3PPct" as fg3Pct, FTPct as ftPct,
           TOV as turnovers
    FROM player_stats_pergame
    WHERE CAST(G as INTEGER) >= ? AND CAST(PTS as FLOAT) >= ?
      ${cfg.seasonFilter}
    ORDER BY RANDOM()
    LIMIT 1
  `).get(cfg.minGames, cfg.minPts);
}

/** Legacy helper — kept for backward compat with existing route. */
export function getRandomPlayerForQuiz() {
  return getPlayerForQuizByDifficulty('medium');
}

/** Better Season — returns two players from the same season whose chosen stat
 *  differs by at least 20 % but is within 80 % of each other (competitive
 *  question). Falls back to fully random if no matching pair is found. */
export function getBetterSeasonPair(stat: 'PTS' | 'TRB' | 'AST' = 'PTS') {
  const db = getDb();

  // Pick a random season first, then find two players within the right range
  const season = (db.prepare(`
    SELECT Season FROM player_stats_pergame
    WHERE CAST(G as INTEGER) >= 40 AND CAST(PTS as FLOAT) >= 12
    GROUP BY Season
    HAVING COUNT(*) >= 10
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as { Season: string } | undefined)?.Season;

  if (!season) return getRandomPairForQuiz();

  const pair = db.prepare(`
    WITH ranked AS (
      SELECT Player as name, Tm as team, Season as season,
             PTS as points, TRB as rebounds, AST as assists, G as games,
             CAST(${stat} as FLOAT) as stat_val
      FROM player_stats_pergame
      WHERE Season = ? AND CAST(G as INTEGER) >= 40
        AND CAST(PTS as FLOAT) >= 12
        AND CAST(${stat} as FLOAT) > 0
    )
    SELECT a.name, a.team, a.season, a.points, a.rebounds, a.assists, a.games
    FROM ranked a
    JOIN ranked b ON a.name < b.name
    WHERE a.stat_val > 0 AND b.stat_val > 0
      AND ABS(a.stat_val - b.stat_val) / MAX(a.stat_val, b.stat_val) BETWEEN 0.05 AND 0.35
    ORDER BY RANDOM()
    LIMIT 2
  `).all(season);

  return pair.length === 2 ? pair : getRandomPairForQuiz();
}

/** Legacy helper. */
export function getRandomPairForQuiz() {
  const db = getDb();
  return db.prepare(`
    SELECT Player as name, Tm as team, Season as season,
           PTS as points, TRB as rebounds, AST as assists, G as games
    FROM player_stats_pergame
    WHERE CAST(G as INTEGER) >= 40 AND CAST(PTS as FLOAT) >= 12
    ORDER BY RANDOM()
    LIMIT 2
  `).all();
}

// ── Shot Chart Guess ──────────────────────────────────────────────────────────

export interface ShotZoneSummary {
  zone: string;
  attPct: number;
  fgPct: number;
}

export interface ShotChartQuiz {
  zones: ShotZoneSummary[];
  options: string[];
  correctAnswer: string;
  season: string;
  totalShots: number;
}

/** Pick a player with ≥300 shots in a season, build zone summary, and return
 *  3 era-matched decoy names so the frontend can render a 4-option quiz. */
export function getShotChartQuiz(): ShotChartQuiz | null {
  const db = getDb();

  const subject = db.prepare(`
    SELECT PLAYER_NAME, season, COUNT(*) as shots
    FROM shots
    GROUP BY PLAYER_NAME, season
    HAVING shots >= 300
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as { PLAYER_NAME: string; season: string; shots: number } | undefined;

  if (!subject) return null;

  const zones = db.prepare(`
    SELECT SHOT_ZONE_BASIC as zone,
           COUNT(*) as attempts,
           ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG as INTEGER)) AS REAL) / COUNT(*) * 100, 1) as fgPct,
           ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as attPct
    FROM shots
    WHERE PLAYER_NAME = ? AND season = ?
      AND SHOT_ZONE_BASIC IS NOT NULL AND TRIM(SHOT_ZONE_BASIC) != ''
    GROUP BY SHOT_ZONE_BASIC
    ORDER BY attPct DESC
  `).all(subject.PLAYER_NAME, subject.season) as ShotZoneSummary[];

  const seasonStart = parseInt(subject.season.split('-')[0], 10);

  const decoys = (db.prepare(`
    SELECT DISTINCT PLAYER_NAME
    FROM shots
    WHERE PLAYER_NAME != ?
      AND CAST(SUBSTR(season, 1, 4) AS INTEGER) BETWEEN ? AND ?
    GROUP BY PLAYER_NAME
    HAVING COUNT(*) >= 200
    ORDER BY RANDOM()
    LIMIT 3
  `).all(
    subject.PLAYER_NAME,
    seasonStart - 4,
    seasonStart + 4,
  ) as { PLAYER_NAME: string }[]).map((r) => r.PLAYER_NAME);

  // Pad decoys with any name if era filter returned fewer than 3
  if (decoys.length < 3) {
    const extra = (db.prepare(`
      SELECT DISTINCT PLAYER_NAME FROM shots
      WHERE PLAYER_NAME != ? ${decoys.map(() => "AND PLAYER_NAME != ?").join(" ")}
      ORDER BY RANDOM()
      LIMIT ?
    `).all(
      subject.PLAYER_NAME,
      ...decoys,
      3 - decoys.length,
    ) as { PLAYER_NAME: string }[]).map((r) => r.PLAYER_NAME);
    decoys.push(...extra);
  }

  const options = [subject.PLAYER_NAME, ...decoys.slice(0, 3)].sort(() => Math.random() - 0.5);

  return {
    zones,
    options,
    correctAnswer: subject.PLAYER_NAME,
    season: subject.season,
    totalShots: subject.shots,
  };
}

// ── Archetype Guess ───────────────────────────────────────────────────────────

export const ALL_ARCHETYPES = [
  'Rim Protector',
  'Floor General',
  'Isolation Scorer',
  '3-and-D Wing',
  'Paint Scorer',
  'Two-Way Star',
  'Playmaking Scorer',
  'Efficient Scorer',
] as const;

export type PlayerArchetype = (typeof ALL_ARCHETYPES)[number];

export interface ArchetypeStatLine {
  pts: number;
  reb: number;
  ast: number;
  games: number;
  per: number;
  usgPct: number;
  tsPct: number;
  astPct: number;
  blkPct: number;
  stlPct: number;
  orbPct: number;
  threePAr: number;
}

export interface ArchetypeQuiz {
  season: number;
  statLine: ArchetypeStatLine;
  options: PlayerArchetype[];
  correctAnswer: PlayerArchetype;
}

function classifyArchetype(s: ArchetypeStatLine): PlayerArchetype {
  if (s.blkPct >= 4.0 && s.threePAr < 0.15) return 'Rim Protector';
  if (s.stlPct >= 2.0 && s.blkPct >= 2.0 && s.usgPct >= 20) return 'Two-Way Star';
  if (s.astPct >= 35.0 && s.usgPct < 28) return 'Floor General';
  if (s.threePAr >= 0.50 && s.usgPct < 23 && s.stlPct >= 1.5) return '3-and-D Wing';
  if (s.threePAr < 0.10 && s.orbPct >= 8.0) return 'Paint Scorer';
  if (s.usgPct >= 28.0 && s.astPct >= 25) return 'Playmaking Scorer';
  if (s.usgPct >= 28.0 && s.astPct < 25) return 'Isolation Scorer';
  return 'Efficient Scorer';
}

/** Return a player's statistical fingerprint (anonymised) plus 4 archetype
 *  options so the frontend can ask "what kind of player is this?". */
export function getArchetypeQuiz(): ArchetypeQuiz | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT a.Player, a.Season,
           CAST(a.PER as FLOAT) as per,
           CAST(a.USGPct as FLOAT) as usgPct,
           CAST(a.TSPct as FLOAT) as tsPct,
           CAST(a.ASTPct as FLOAT) as astPct,
           CAST(a.BLKPct as FLOAT) as blkPct,
           CAST(a.STLPct as FLOAT) as stlPct,
           CAST(a.ORBPct as FLOAT) as orbPct,
           CAST(a."3PAr" as FLOAT) as threePAr,
           CAST(s.PTS as FLOAT) as pts,
           CAST(s.TRB as FLOAT) as reb,
           CAST(s.AST as FLOAT) as ast,
           CAST(s.G as INTEGER) as games
    FROM player_stats_advanced a
    JOIN player_stats_pergame s
      ON a.Player = s.Player AND a.Season = s.Season AND a.Tm = s.Tm
    WHERE CAST(a.G as INTEGER) >= 40
      AND a.USGPct IS NOT NULL AND CAST(a.USGPct as FLOAT) > 0
      AND a.PER IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as (ArchetypeStatLine & { Player: string; Season: number }) | undefined;

  if (!row) return null;

  const statLine: ArchetypeStatLine = {
    pts: row.pts,
    reb: row.reb,
    ast: row.ast,
    games: row.games,
    per: row.per,
    usgPct: row.usgPct,
    tsPct: row.tsPct,
    astPct: row.astPct,
    blkPct: row.blkPct,
    stlPct: row.stlPct,
    orbPct: row.orbPct,
    threePAr: row.threePAr,
  };

  const correct = classifyArchetype(statLine);
  const decoys = (ALL_ARCHETYPES.filter((a) => a !== correct) as PlayerArchetype[])
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = ([correct, ...decoys] as PlayerArchetype[]).sort(() => Math.random() - 0.5);

  return { season: row.Season, statLine, options, correctAnswer: correct };
}

// ── Shot Lab ─────────────────────────────────────────────────────────────────
// Zone definitions used for What-If modeling
// 2-pt zones: Restricted Area, In The Paint (Non-RA), Mid-Range
// 3-pt zones: Above the Break 3, Left Corner 3, Right Corner 3

export interface ZoneRow {
  zone: string;
  area: string;
  attempts: number;
  makes: number;
  fgPct: number;
  attPct: number;
}

export interface LeagueZoneRow extends ZoneRow {
  leagueAttPct: number;
  leagueFgPct: number;
}

/** Zone profile for a single player (optionally filtered by season). */
export function getPlayerZoneProfile(playerName: string, season?: string): ZoneRow[] {
  const db = getDb();
  const seasonFilter = season
    ? 'AND season = ?'
    : '';
  const params = season ? [playerName, season] : [playerName];
  return db.prepare(`
    SELECT SHOT_ZONE_BASIC as zone, SHOT_ZONE_AREA as area,
           COUNT(*) as attempts,
           SUM(CAST(SHOT_MADE_FLAG as INTEGER)) as makes,
           ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG as INTEGER)) AS REAL) / COUNT(*) * 100, 2) as fgPct,
           ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as attPct
    FROM shots
    WHERE PLAYER_NAME = ? ${seasonFilter}
      AND SHOT_ZONE_BASIC IS NOT NULL AND TRIM(SHOT_ZONE_BASIC) != ''
    GROUP BY SHOT_ZONE_BASIC, SHOT_ZONE_AREA
    ORDER BY attempts DESC
  `).all(...params) as ZoneRow[];
}

/** League-wide zone distribution for a given season (or latest if omitted). */
export function getLeagueZoneBaseline(season?: string): ZoneRow[] {
  const db = getDb();
  const targetSeason = season || (db.prepare(
    `SELECT MAX(season) as s FROM shots`
  ).get() as { s: string })?.s;
  return db.prepare(`
    SELECT SHOT_ZONE_BASIC as zone, SHOT_ZONE_AREA as area,
           COUNT(*) as attempts,
           SUM(CAST(SHOT_MADE_FLAG as INTEGER)) as makes,
           ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG as INTEGER)) AS REAL) / COUNT(*) * 100, 2) as fgPct,
           ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as attPct
    FROM shots
    WHERE season = ?
      AND SHOT_ZONE_BASIC IS NOT NULL AND TRIM(SHOT_ZONE_BASIC) != ''
    GROUP BY SHOT_ZONE_BASIC, SHOT_ZONE_AREA
    ORDER BY attempts DESC
  `).all(targetSeason) as ZoneRow[];
}

/** Player zone profile merged with league average for the same season. */
export function getPlayerZoneProfileWithLeague(
  playerName: string,
  season?: string
): LeagueZoneRow[] {
  const db = getDb();
  const targetSeason = season || (db.prepare(
    `SELECT MAX(season) as s FROM shots WHERE PLAYER_NAME = ?`
  ).get(playerName) as { s: string | null })?.s;

  if (!targetSeason) return [];

  const player = getPlayerZoneProfile(playerName, targetSeason);
  const league = getLeagueZoneBaseline(targetSeason);

  const leagueMap = new Map<string, ZoneRow>();
  for (const row of league) {
    leagueMap.set(`${row.zone}|${row.area}`, row);
  }

  return player.map((p) => {
    const lg = leagueMap.get(`${p.zone}|${p.area}`);
    return {
      ...p,
      leagueAttPct: lg?.attPct ?? 0,
      leagueFgPct: lg?.fgPct ?? 0,
    };
  });
}

/** Seasons available for a player in the shots table. */
export function getShotLabSeasons(playerName: string): string[] {
  const db = getDb();
  return (db.prepare(
    `SELECT DISTINCT season FROM shots WHERE PLAYER_NAME = ? ORDER BY season DESC`
  ).all(playerName) as { season: string }[]).map((r) => r.season);
}

/** Compare zone profiles of two players for the same season. */
export function compareShotZoneProfiles(
  player1: string,
  player2: string,
  season?: string
) {
  const db = getDb();
  const targetSeason = season || (db.prepare(
    `SELECT MAX(season) as s FROM shots`
  ).get() as { s: string })?.s;

  return {
    season: targetSeason,
    player1: getPlayerZoneProfile(player1, targetSeason),
    player2: getPlayerZoneProfile(player2, targetSeason),
    league: getLeagueZoneBaseline(targetSeason),
  };
}

interface WhatIfAdjustment {
  fromZone: string;
  fromArea: string;
  toZone: string;
  toArea: string;
  shiftPct: number; // percentage points of total attempts to shift
}

/** Model impact of shifting shot attempts between zones. */
export function modelWhatIfShotMix(
  playerName: string,
  season: string,
  adjustments: WhatIfAdjustment[]
) {
  const profile = getPlayerZoneProfile(playerName, season);
  const totalAttempts = profile.reduce((s, r) => s + r.attempts, 0);
  if (totalAttempts === 0) return null;

  // point value per zone: 3-pt zones score 3, all others score 2
  const threePointZones = new Set([
    'Above the Break 3', 'Left Corner 3', 'Right Corner 3', 'Backcourt'
  ]);

  function pointValue(zone: string) {
    return threePointZones.has(zone) ? 3 : 2;
  }

  // Build mutable map of attPct by zone|area
  const attPctMap = new Map<string, number>();
  const fgPctMap = new Map<string, number>();
  for (const row of profile) {
    const key = `${row.zone}|${row.area}`;
    attPctMap.set(key, row.attPct);
    fgPctMap.set(key, row.fgPct / 100);
  }

  // Baseline expected points per 100 shot attempts
  function calcExpPts(map: Map<string, number>) {
    let ePts = 0;
    for (const row of profile) {
      const key = `${row.zone}|${row.area}`;
      const pct = (map.get(key) ?? 0) / 100;
      const fgp = fgPctMap.get(key) ?? 0;
      ePts += pct * fgp * pointValue(row.zone);
    }
    return Math.round(ePts * 100 * 100) / 100; // per 100 attempts
  }

  const baselineEPts = calcExpPts(attPctMap);

  // Apply adjustments (clamp so we don't go below 0)
  const adjustedMap = new Map(attPctMap);
  for (const adj of adjustments) {
    const fromKey = `${adj.fromZone}|${adj.fromArea}`;
    const toKey = `${adj.toZone}|${adj.toArea}`;
    const currentFrom = adjustedMap.get(fromKey) ?? 0;
    const shift = Math.min(adj.shiftPct, currentFrom);
    adjustedMap.set(fromKey, currentFrom - shift);
    adjustedMap.set(toKey, (adjustedMap.get(toKey) ?? 0) + shift);
  }

  const adjustedEPts = calcExpPts(adjustedMap);

  return {
    player: playerName,
    season,
    totalAttempts,
    baseline: {
      ePtsPer100: baselineEPts,
      distribution: profile.map((r) => ({
        zone: r.zone,
        area: r.area,
        attPct: r.attPct,
        fgPct: r.fgPct,
      })),
    },
    adjusted: {
      ePtsPer100: adjustedEPts,
      delta: Math.round((adjustedEPts - baselineEPts) * 100) / 100,
      distribution: profile.map((r) => {
        const key = `${r.zone}|${r.area}`;
        return {
          zone: r.zone,
          area: r.area,
          attPct: adjustedMap.get(key) ?? 0,
          fgPct: r.fgPct,
        };
      }),
    },
  };
}
