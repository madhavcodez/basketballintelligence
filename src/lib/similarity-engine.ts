import { getDb } from './db';
import type { SeasonType } from './playoffs-db';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SimilarPlayerResult {
  readonly name: string;
  readonly team: string;
  readonly season: string;
  readonly similarity: number;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly per: number;
  readonly tsPct: number;
  readonly usgPct: number;
  readonly personId?: number;
}

export interface SimilarPlayersResponse {
  readonly data: readonly SimilarPlayerResult[];
  readonly seasonType: SeasonType;
  readonly playoffAvailable: boolean;
}

// ── Table allowlist ─────────────────────────────────────────────────────────

const ADVANCED_TABLES = { regular: 'player_stats_advanced', playoffs: 'player_stats_playoffs_advanced' } as const;
const PERGAME_TABLES = { regular: 'player_stats_pergame', playoffs: 'player_stats_playoffs_pergame' } as const;

const SIMILARITY_STATS = ['TSPct', 'USGPct', 'off_rating', 'def_rating', 'efg_pct', 'ASTPct', 'TRBPct', 'pie'] as const;
const DISPLAY_STATS = ['PTS', 'TRB', 'AST'] as const;

// ── Pure math helpers ───────────────────────────────────────────────────────

export function computeZScores(values: readonly number[]): readonly number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tableExists(db: ReturnType<typeof getDb>, name: string): boolean {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?`,
  ).get(name) as { count: number } | undefined;
  return (row?.count ?? 0) > 0;
}

function toFloat(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface RawRow {
  readonly Player: string;
  readonly Tm: string;
  readonly Season: string;
  readonly person_id?: number;
  readonly [key: string]: unknown;
}

// ── Main engine ─────────────────────────────────────────────────────────────

export function findSimilarPlayersAdvanced(
  name: string,
  seasonType: SeasonType,
  season?: string,
  limit: number = 5,
): SimilarPlayersResponse {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 25);
  const hasPlayoffAdv = tableExists(db, 'player_stats_playoffs_advanced');
  const hasPlayoffPg = tableExists(db, 'player_stats_playoffs_pergame');
  const empty: SimilarPlayersResponse = { data: [], seasonType, playoffAvailable: hasPlayoffAdv };

  if (seasonType === 'playoffs' && !hasPlayoffAdv) {
    return { ...empty, playoffAvailable: false };
  }

  const advTable = seasonType === 'playoffs' && hasPlayoffAdv
    ? ADVANCED_TABLES.playoffs : ADVANCED_TABLES.regular;
  const pgTable = seasonType === 'playoffs' && hasPlayoffPg
    ? PERGAME_TABLES.playoffs : PERGAME_TABLES.regular;

  const targetSeason = season || (() => {
    const row = db.prepare(`SELECT MAX(Season) as s FROM "${advTable}"`).get() as { s: string } | undefined;
    return row?.s || '';
  })();
  if (!targetSeason) return empty;

  const simCols = SIMILARITY_STATS.map((c) => `CAST(a.${c} as FLOAT) as "${c}"`).join(', ');
  const displayCols = DISPLAY_STATS.map((c) => `CAST(s.${c} as FLOAT) as "${c}"`).join(', ');

  const rows = db.prepare(`
    SELECT a.Player, a.Tm, a.Season, ${simCols}, ${displayCols}, p.person_id
    FROM "${advTable}" a
    LEFT JOIN "${pgTable}" s ON s.Player = a.Player AND s.Season = a.Season AND s.Tm = a.Tm
    LEFT JOIN players p ON p.Player = a.Player
    WHERE a.Season = ? AND CAST(a.G as INTEGER) >= 20
  `).all(targetSeason) as readonly RawRow[];

  if (rows.length < 3) return empty;

  // Build raw stat matrix and compute Z-scores column-by-column
  const rawMatrix = rows.map((row) => SIMILARITY_STATS.map((k) => toFloat(row[k])));
  const numStats = SIMILARITY_STATS.length;
  const zMatrix: number[][] = Array.from({ length: rows.length }, () => Array(numStats).fill(0) as number[]);

  for (let col = 0; col < numStats; col++) {
    const zScores = computeZScores(rawMatrix.map((r) => r[col]));
    for (let row = 0; row < rows.length; row++) {
      zMatrix[row][col] = zScores[row];
    }
  }

  const targetIdx = rows.findIndex((r) => r.Player.toLowerCase() === name.toLowerCase());
  if (targetIdx === -1) return empty;

  const targetZ = zMatrix[targetIdx];
  const scored = rows
    .map((_, idx) => ({ idx, similarity: idx === targetIdx ? -Infinity : cosineSimilarity(targetZ, zMatrix[idx]) }))
    .filter((e) => e.idx !== targetIdx)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, safeLimit);

  const data: readonly SimilarPlayerResult[] = scored.map((entry) => {
    const row = rows[entry.idx];
    const simPct = Math.round(((entry.similarity + 1) / 2) * 100);
    return {
      name: String(row.Player),
      team: String(row.Tm),
      season: String(row.Season),
      similarity: Math.min(100, Math.max(0, simPct)),
      points: toFloat(row.PTS),
      rebounds: toFloat(row.TRB),
      assists: toFloat(row.AST),
      per: toFloat(row.pie) * 100,
      tsPct: toFloat(row.TSPct),
      usgPct: toFloat(row.USGPct),
      personId: row.person_id ?? undefined,
    };
  });

  return { data, seasonType, playoffAvailable: hasPlayoffAdv };
}
