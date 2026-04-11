import Database from 'better-sqlite3';
import path from 'path';

// ─── Singleton ──────────────────────────────────────────────────────────────
//
// NOTE: Unlike basketball.db (read-only analytics DB), film.db is intentionally
// opened read-write. The Film Room workflow needs to insert clips, tags,
// annotations, and processing-job rows at runtime. Schema is created on first
// access via SCHEMA_SQL below — every CREATE statement uses IF NOT EXISTS so
// repeated process boots are safe.

let filmDb: Database.Database | null = null;

export function getFilmDb(): Database.Database {
  if (!filmDb) {
    const dbPath = path.join(process.cwd(), 'data', 'film.db');
    filmDb = new Database(dbPath);
    filmDb.pragma('journal_mode = WAL');
    filmDb.pragma('cache_size = -16384'); // 16MB cache
    filmDb.pragma('temp_store = MEMORY');
    filmDb.exec(SCHEMA_SQL);
  }
  return filmDb;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  fps REAL,
  file_size_bytes INTEGER,
  source_type TEXT CHECK(source_type IN ('upload', 'youtube', 'local', 'stream')),
  source_url TEXT,
  game_id TEXT,
  game_date TEXT,
  home_team TEXT,
  away_team TEXT,
  season TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  title TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  duration REAL GENERATED ALWAYS AS (end_time - start_time) STORED,
  thumbnail_path TEXT,
  quarter INTEGER,
  game_clock TEXT,
  shot_clock REAL,
  score_home INTEGER,
  score_away INTEGER,
  possession_type TEXT,
  play_type TEXT,
  primary_action TEXT,
  shot_result TEXT,
  primary_player TEXT,
  secondary_player TEXT,
  defender TEXT,
  player_game_log_id TEXT,
  shot_id TEXT,
  confidence REAL DEFAULT 0.0,
  manually_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT CHECK(category IN ('action', 'player', 'team', 'context', 'quality', 'custom')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clip_tags (
  clip_id INTEGER NOT NULL REFERENCES clips(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (clip_id, tag_id)
);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL REFERENCES clips(id),
  timestamp REAL NOT NULL,
  annotation_type TEXT CHECK(annotation_type IN ('note', 'player_id', 'action', 'highlight')),
  content TEXT NOT NULL,
  x REAL,
  y REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  job_type TEXT CHECK(job_type IN ('quick', 'deep', 'align')),
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
  progress REAL DEFAULT 0.0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  result_summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id);
CREATE INDEX IF NOT EXISTS idx_clips_player ON clips(primary_player);
CREATE INDEX IF NOT EXISTS idx_clips_play_type ON clips(play_type);
CREATE INDEX IF NOT EXISTS idx_clips_action ON clips(primary_action);
CREATE INDEX IF NOT EXISTS idx_clip_tags_clip ON clip_tags(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_tags_tag ON clip_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_annotations_clip ON annotations(clip_id);
`;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoRow {
  readonly id: number;
  readonly title: string;
  readonly filename: string;
  readonly filepath: string;
  readonly duration_seconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly file_size_bytes: number | null;
  readonly source_type: string | null;
  readonly source_url: string | null;
  readonly game_id: string | null;
  readonly game_date: string | null;
  readonly home_team: string | null;
  readonly away_team: string | null;
  readonly season: string | null;
  readonly status: string;
  readonly error_message: string | null;
  readonly processed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ClipRow {
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

export interface TagRow {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly created_at: string;
}

export interface AnnotationRow {
  readonly id: number;
  readonly clip_id: number;
  readonly timestamp: number;
  readonly annotation_type: string;
  readonly content: string;
  readonly x: number | null;
  readonly y: number | null;
  readonly created_at: string;
}

export interface ProcessingJobRow {
  readonly id: number;
  readonly video_id: number;
  readonly job_type: string;
  readonly status: string;
  readonly progress: number;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly error_message: string | null;
  readonly result_summary: string | null;
  readonly created_at: string;
}

// ─── Query helpers ──────────────────────────────────────────────────────────

function clampLimit(value: number | undefined, defaultVal: number, max: number): number {
  const n = value ?? defaultVal;
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

function clampOffset(value: number | undefined): number {
  const n = value ?? 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// ─── Video queries ──────────────────────────────────────────────────────────

export function getVideo(id: number): VideoRow | undefined {
  return getFilmDb().prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRow | undefined;
}

export function listVideos(limit?: number, offset?: number): { videos: VideoRow[]; total: number } {
  const db = getFilmDb();
  const safeLimit = clampLimit(limit, 20, 100);
  const safeOffset = clampOffset(offset);
  const videos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(safeLimit, safeOffset) as VideoRow[];
  const total = (db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number }).count;
  return { videos, total };
}

export function insertVideo(data: {
  title: string;
  filename: string;
  filepath: string;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  file_size_bytes?: number | null;
  source_type?: string;
  source_url?: string | null;
  game_id?: string | null;
  game_date?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  season?: string | null;
}): number {
  const result = getFilmDb().prepare(`
    INSERT INTO videos (title, filename, filepath, duration_seconds, width, height,
                        fps, file_size_bytes, source_type, source_url,
                        game_id, game_date, home_team, away_team, season)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.title, data.filename, data.filepath,
    data.duration_seconds ?? null, data.width ?? null, data.height ?? null,
    data.fps ?? null, data.file_size_bytes ?? null,
    data.source_type ?? 'upload', data.source_url ?? null,
    data.game_id ?? null, data.game_date ?? null,
    data.home_team ?? null, data.away_team ?? null, data.season ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function updateVideoStatus(id: number, status: string, errorMessage?: string): void {
  getFilmDb().prepare(`
    UPDATE videos SET status = ?, error_message = ?, updated_at = datetime('now'),
    processed_at = CASE WHEN ? IN ('ready', 'error') THEN datetime('now') ELSE processed_at END
    WHERE id = ?
  `).run(status, errorMessage ?? null, status, id);
}

// ─── Clip queries ───────────────────────────────────────────────────────────

export interface ClipFilters {
  readonly player?: string;
  readonly playType?: string;
  readonly action?: string;
  readonly tag?: string;
  readonly gameDate?: string;
  readonly videoId?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export function listClips(filters: ClipFilters): { clips: ClipRow[]; total: number } {
  const db = getFilmDb();
  const safeLimit = clampLimit(filters.limit, 20, 100);
  const safeOffset = clampOffset(filters.offset);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.player) {
    conditions.push('c.primary_player LIKE ?');
    params.push(`%${filters.player}%`);
  }
  if (filters.playType) {
    conditions.push('c.play_type = ?');
    params.push(filters.playType);
  }
  if (filters.action) {
    conditions.push('c.primary_action = ?');
    params.push(filters.action);
  }
  if (filters.gameDate) {
    conditions.push('v.game_date = ?');
    params.push(filters.gameDate);
  }
  if (filters.videoId) {
    conditions.push('c.video_id = ?');
    params.push(filters.videoId);
  }

  let joinClause = '';
  if (filters.tag) {
    joinClause = `
      JOIN clip_tags ct ON c.id = ct.clip_id
      JOIN tags t ON ct.tag_id = t.id
    `;
    conditions.push('t.name = ?');
    params.push(filters.tag);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const joinVideo = filters.gameDate ? 'JOIN videos v ON c.video_id = v.id' : '';

  const clips = db.prepare(`
    SELECT DISTINCT c.* FROM clips c
    ${joinVideo}
    ${joinClause}
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, safeOffset) as ClipRow[];

  const totalRow = db.prepare(`
    SELECT COUNT(DISTINCT c.id) as count FROM clips c
    ${joinVideo}
    ${joinClause}
    ${whereClause}
  `).get(...params) as { count: number };

  return { clips, total: totalRow.count };
}

export function getClip(id: number): ClipRow | undefined {
  return getFilmDb().prepare('SELECT * FROM clips WHERE id = ?').get(id) as ClipRow | undefined;
}

/**
 * Smart search: splits query into tokens and requires ALL tokens to match
 * across any combination of fields. "LeBron dunking" finds clips where
 * one field matches "LeBron" AND another matches "dunk".
 *
 * Also expands common synonyms: dunking→dunk, shooting→shot, threes→three pointer, etc.
 */
export function searchClips(query: string, limit?: number): ClipRow[] {
  const safeLimit = clampLimit(limit, 20, 100);

  // Synonym expansion for natural language
  const SYNONYMS: Record<string, string[]> = {
    dunking: ['dunk'],
    dunks: ['dunk'],
    shooting: ['shot', 'shoot', 'jumper'],
    shoots: ['shot', 'shoot'],
    threes: ['three pointer', 'three'],
    '3s': ['three pointer', 'three'],
    '3pt': ['three pointer'],
    layups: ['layup'],
    blocks: ['block', 'blocked'],
    blocking: ['block', 'blocked'],
    steals: ['steal'],
    stealing: ['steal'],
    assists: ['assist', 'pass'],
    passing: ['pass', 'assist'],
    driving: ['drive'],
    posting: ['post up'],
    fastbreak: ['fastbreak', 'transition'],
    iso: ['isolation'],
    pnr: ['pick & roll', 'pnr ball handler'],
    'pick and roll': ['pick & roll'],
    fadeaways: ['fadeaway'],
    stepbacks: ['stepback'],
    rebounds: ['rebound'],
    rebounding: ['rebound'],
    makes: ['made'],
    misses: ['missed'],
  };

  let normalized = query.toLowerCase().trim();
  if (!normalized) return [];

  // Multi-word phrase synonyms (replace before tokenizing)
  const PHRASE_SYNONYMS: Record<string, string> = {
    'pick and roll': 'pick & roll',
    'pick n roll': 'pick & roll',
    'pick and pop': 'pick & pop',
    'catch and shoot': 'catch & shoot',
    'post up': 'post up',
    'off screen': 'off screen',
    'pull up': 'pull-up',
    'pull up jumper': 'pull-up jumper',
  };
  for (const [phrase, replacement] of Object.entries(PHRASE_SYNONYMS)) {
    if (normalized.includes(phrase)) {
      normalized = normalized.replace(phrase, replacement);
    }
  }

  // Stopwords to remove
  const STOPWORDS = new Set(['and', 'the', 'of', 'a', 'an', 'in', 'on', 'for', 'to', 'vs', 'by', 'at', 'is', 'it', 'his', 'her', 'from', 'with']);

  const rawTokens = normalized.split(/\s+/).filter(t => t && !STOPWORDS.has(t));
  if (rawTokens.length === 0) return [];

  // Expand single-word synonyms
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const expanded = SYNONYMS[t];
    if (expanded) {
      tokens.push(expanded[0]);
    } else {
      tokens.push(t);
    }
  }

  // Build WHERE: every token must match at least one searchable field
  const searchFields = `(
    LOWER(COALESCE(c.primary_player, '')) || ' ' ||
    LOWER(COALESCE(c.play_type, '')) || ' ' ||
    LOWER(COALESCE(c.primary_action, '')) || ' ' ||
    LOWER(COALESCE(c.title, '')) || ' ' ||
    LOWER(COALESCE(c.shot_result, '')) || ' ' ||
    LOWER(COALESCE(c.secondary_player, '')) || ' ' ||
    LOWER(COALESCE(c.defender, '')) || ' ' ||
    LOWER(COALESCE(v.home_team, '')) || ' ' ||
    LOWER(COALESCE(v.away_team, '')) || ' ' ||
    LOWER(COALESCE(v.title, ''))
  )`;

  const conditions = tokens.map(() => `${searchFields} LIKE ?`);
  const params = tokens.map((t) => `%${t}%`);

  // Relevance scoring: more field matches = higher rank
  const scoreExpr = tokens.map(() =>
    `(CASE WHEN LOWER(COALESCE(c.primary_player,'')) LIKE ? THEN 3 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(c.play_type,'')) LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(c.primary_action,'')) LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(c.shot_result,'')) LIKE ? THEN 1 ELSE 0 END)`
  ).join(' + ');
  const scoreParams = tokens.flatMap((t) => [`%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`]);

  return getFilmDb().prepare(`
    SELECT c.*, (${scoreExpr}) as relevance FROM clips c
    LEFT JOIN videos v ON c.video_id = v.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY relevance DESC, c.confidence DESC
    LIMIT ?
  `).all(
    ...scoreParams,
    ...params,
    safeLimit,
  ) as ClipRow[];
}

export function insertClip(data: {
  video_id: number;
  title?: string | null;
  start_time: number;
  end_time: number;
  thumbnail_path?: string | null;
  quarter?: number | null;
  game_clock?: string | null;
  shot_clock?: number | null;
  score_home?: number | null;
  score_away?: number | null;
  possession_type?: string | null;
  play_type?: string | null;
  primary_action?: string | null;
  shot_result?: string | null;
  primary_player?: string | null;
  secondary_player?: string | null;
  defender?: string | null;
  confidence?: number;
}): number {
  const result = getFilmDb().prepare(`
    INSERT INTO clips (video_id, title, start_time, end_time, thumbnail_path,
                       quarter, game_clock, shot_clock, score_home, score_away,
                       possession_type, play_type, primary_action, shot_result,
                       primary_player, secondary_player, defender, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.video_id, data.title ?? null, data.start_time, data.end_time,
    data.thumbnail_path ?? null, data.quarter ?? null, data.game_clock ?? null,
    data.shot_clock ?? null, data.score_home ?? null, data.score_away ?? null,
    data.possession_type ?? null, data.play_type ?? null, data.primary_action ?? null,
    data.shot_result ?? null, data.primary_player ?? null, data.secondary_player ?? null,
    data.defender ?? null, data.confidence ?? 0,
  );
  return Number(result.lastInsertRowid);
}

export interface ClipUpdate {
  readonly title?: string;
  readonly play_type?: string;
  readonly primary_action?: string;
  readonly shot_result?: string | null;
  readonly primary_player?: string | null;
  readonly secondary_player?: string | null;
  readonly defender?: string | null;
  readonly reviewed?: number;
}

export function updateClip(id: number, data: ClipUpdate): boolean {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.play_type !== undefined) { fields.push('play_type = ?'); values.push(data.play_type); }
  if (data.primary_action !== undefined) { fields.push('primary_action = ?'); values.push(data.primary_action); }
  if (data.shot_result !== undefined) { fields.push('shot_result = ?'); values.push(data.shot_result); }
  if (data.primary_player !== undefined) { fields.push('primary_player = ?'); values.push(data.primary_player); }
  if (data.secondary_player !== undefined) { fields.push('secondary_player = ?'); values.push(data.secondary_player); }
  if (data.defender !== undefined) { fields.push('defender = ?'); values.push(data.defender); }
  if (data.reviewed !== undefined) { fields.push('reviewed = ?'); values.push(data.reviewed); }

  if (fields.length === 0) return false;

  // Always mark as manually verified when edited
  fields.push('manually_verified = 1');
  values.push(id);

  const result = getFilmDb().prepare(
    `UPDATE clips SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  return result.changes > 0;
}

// ─── Tag queries ────────────────────────────────────────────────────────────

export function getClipTags(clipId: number): Array<{ name: string; category: string; confidence: number }> {
  return getFilmDb().prepare(`
    SELECT t.name, t.category, ct.confidence
    FROM clip_tags ct JOIN tags t ON ct.tag_id = t.id
    WHERE ct.clip_id = ?
    ORDER BY ct.confidence DESC
  `).all(clipId) as Array<{ name: string; category: string; confidence: number }>;
}

export function getAllTags(): Array<{ name: string; category: string; count: number }> {
  return getFilmDb().prepare(`
    SELECT t.name, t.category, COUNT(ct.clip_id) as count
    FROM tags t LEFT JOIN clip_tags ct ON t.id = ct.tag_id
    GROUP BY t.id
    ORDER BY count DESC
  `).all() as Array<{ name: string; category: string; count: number }>;
}

export function addClipTag(clipId: number, tagName: string, category: string, confidence: number = 1.0): void {
  const db = getFilmDb();
  db.prepare(`INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)`).run(tagName, category);
  const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number } | undefined;
  if (tag) {
    db.prepare(`INSERT OR REPLACE INTO clip_tags (clip_id, tag_id, confidence) VALUES (?, ?, ?)`)
      .run(clipId, tag.id, confidence);
  }
}

// ─── Annotation queries ─────────────────────────────────────────────────────

export function getClipAnnotations(clipId: number): AnnotationRow[] {
  return getFilmDb().prepare(`
    SELECT * FROM annotations WHERE clip_id = ? ORDER BY timestamp ASC
  `).all(clipId) as AnnotationRow[];
}

export function addAnnotation(data: {
  clip_id: number;
  timestamp: number;
  annotation_type: string;
  content: string;
  x?: number | null;
  y?: number | null;
}): number {
  const result = getFilmDb().prepare(`
    INSERT INTO annotations (clip_id, timestamp, annotation_type, content, x, y)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.clip_id, data.timestamp, data.annotation_type, data.content, data.x ?? null, data.y ?? null);
  return Number(result.lastInsertRowid);
}

// ─── Processing job queries ─────────────────────────────────────────────────

export function createProcessingJob(videoId: number, jobType: string): number {
  const result = getFilmDb().prepare(`
    INSERT INTO processing_jobs (video_id, job_type) VALUES (?, ?)
  `).run(videoId, jobType);
  return Number(result.lastInsertRowid);
}

export function getProcessingJob(id: number): ProcessingJobRow | undefined {
  return getFilmDb().prepare('SELECT * FROM processing_jobs WHERE id = ?').get(id) as ProcessingJobRow | undefined;
}

export function updateProcessingJob(id: number, updates: {
  status?: string;
  progress?: number;
  error_message?: string | null;
  result_summary?: string | null;
}): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
    if (updates.status === 'running') {
      sets.push("started_at = datetime('now')");
    }
    if (updates.status === 'completed' || updates.status === 'failed') {
      sets.push("completed_at = datetime('now')");
    }
  }
  if (updates.progress !== undefined) {
    sets.push('progress = ?');
    params.push(updates.progress);
  }
  if (updates.error_message !== undefined) {
    sets.push('error_message = ?');
    params.push(updates.error_message);
  }
  if (updates.result_summary !== undefined) {
    sets.push('result_summary = ?');
    params.push(updates.result_summary);
  }

  if (sets.length === 0) return;
  params.push(id);
  getFilmDb().prepare(`UPDATE processing_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

// ─── Aggregate queries ──────────────────────────────────────────────────────

export function getVideoSummary(videoId: number): {
  video: VideoRow | undefined;
  clipCount: number;
  tagCounts: Record<string, number>;
  playerMentions: Array<{ player: string; clipCount: number }>;
} {
  const db = getFilmDb();
  const video = getVideo(videoId);
  const clipCount = (db.prepare('SELECT COUNT(*) as count FROM clips WHERE video_id = ?')
    .get(videoId) as { count: number }).count;

  const tagRows = db.prepare(`
    SELECT t.name, COUNT(*) as count
    FROM clip_tags ct
    JOIN tags t ON ct.tag_id = t.id
    JOIN clips c ON ct.clip_id = c.id
    WHERE c.video_id = ?
    GROUP BY t.name ORDER BY count DESC
  `).all(videoId) as Array<{ name: string; count: number }>;

  const tagCounts: Record<string, number> = {};
  for (const row of tagRows) {
    tagCounts[row.name] = row.count;
  }

  const playerMentions = db.prepare(`
    SELECT primary_player as player, COUNT(*) as clipCount
    FROM clips WHERE video_id = ? AND primary_player IS NOT NULL
    GROUP BY primary_player ORDER BY clipCount DESC
  `).all(videoId) as Array<{ player: string; clipCount: number }>;

  return { video, clipCount, tagCounts, playerMentions };
}

export function getRelatedClips(clipId: number, limit: number = 8): ClipRow[] {
  const clip = getClip(clipId);
  if (!clip) return [];

  // SQL: `col = NULL` is always false. If both primary_player and play_type
  // are null we have no signal to relate on, so bail out. Otherwise build a
  // WHERE that only references the non-null fields, and order by the player
  // match (when present) so player matches surface above play-type matches.
  const hasPlayer = clip.primary_player != null;
  const hasPlayType = clip.play_type != null;
  if (!hasPlayer && !hasPlayType) return [];

  const conditions: string[] = [];
  const params: Array<string | number> = [clipId];
  if (hasPlayer) {
    conditions.push('primary_player = ?');
    params.push(clip.primary_player as string);
  }
  if (hasPlayType) {
    conditions.push('play_type = ?');
    params.push(clip.play_type as string);
  }

  const orderBy = hasPlayer
    ? 'ORDER BY CASE WHEN primary_player = ? THEN 0 ELSE 1 END, created_at DESC'
    : 'ORDER BY created_at DESC';
  if (hasPlayer) params.push(clip.primary_player as string);
  params.push(limit);

  return getFilmDb().prepare(`
    SELECT * FROM clips
    WHERE id != ? AND (${conditions.join(' OR ')})
    ${orderBy}
    LIMIT ?
  `).all(...params) as ClipRow[];
}

export function getPlayTypeCounts(): Array<{ play_type: string; count: number }> {
  return getFilmDb().prepare(`
    SELECT play_type, COUNT(*) as count FROM clips
    WHERE play_type IS NOT NULL
    GROUP BY play_type ORDER BY count DESC
  `).all() as Array<{ play_type: string; count: number }>;
}

export function getPlayerClipCounts(): Array<{ player: string; count: number }> {
  return getFilmDb().prepare(`
    SELECT primary_player as player, COUNT(*) as count FROM clips
    WHERE primary_player IS NOT NULL
    GROUP BY primary_player ORDER BY count DESC
  `).all() as Array<{ player: string; count: number }>;
}
