/**
 * Seed script for film.db — populates the database with realistic NBA demo data.
 *
 * Usage:  npx tsx src/scripts/seed-film-data.ts
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// ─── Ensure directories ──────────────────────────────────────────────────────

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CLIPS_DIR = path.join(DATA_DIR, 'clips');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CLIPS_DIR, { recursive: true });

// ─── Open (or create) the database ──────────────────────────────────────────

const DB_PATH = path.join(DATA_DIR, 'film.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure schema exists (idempotent — mirrors film-db.ts SCHEMA_SQL)
db.exec(`
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
`);

// ─── Guard: skip if data already seeded ──────────────────────────────────────

const clipCount = (db.prepare('SELECT COUNT(*) as count FROM clips').get() as { count: number }).count;
if (clipCount > 0) {
  console.log(`Database already contains ${clipCount} clips — skipping seed.`);
  db.close();
  process.exit(0);
}

console.log('Seeding film.db with demo data...\n');

// ─── Helper utilities ────────────────────────────────────────────────────────

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomFloat(min, max + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function gameClock(quarter: number): string {
  const minutes = quarter === 5 ? randomInt(0, 4) : randomInt(0, 11);
  const seconds = randomInt(0, 59);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ─── Reference data ──────────────────────────────────────────────────────────

interface VideoSpec {
  readonly title: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly gameDate: string;
  readonly duration: number;
  readonly homePlayers: readonly string[];
  readonly awayPlayers: readonly string[];
}

const VIDEOS: readonly VideoSpec[] = [
  {
    title: 'Lakers vs Warriors - Jan 15, 2025',
    homeTeam: 'LAL',
    awayTeam: 'GSW',
    gameDate: '2025-01-15',
    duration: 7200,
    homePlayers: ['LeBron James', 'Anthony Davis', "D'Angelo Russell", 'Austin Reaves'],
    awayPlayers: ['Stephen Curry', 'Klay Thompson', 'Draymond Green', 'Andrew Wiggins'],
  },
  {
    title: 'Celtics vs Bucks - Dec 28, 2024',
    homeTeam: 'BOS',
    awayTeam: 'MIL',
    gameDate: '2024-12-28',
    duration: 7080,
    homePlayers: ['Jayson Tatum', 'Jaylen Brown', 'Derrick White', 'Kristaps Porzingis'],
    awayPlayers: ['Giannis Antetokounmpo', 'Damian Lillard', 'Khris Middleton'],
  },
  {
    title: 'Nuggets vs Timberwolves - Feb 3, 2025',
    homeTeam: 'DEN',
    awayTeam: 'MIN',
    gameDate: '2025-02-03',
    duration: 7320,
    homePlayers: ['Nikola Jokic', 'Jamal Murray', 'Michael Porter Jr.', 'Aaron Gordon'],
    awayPlayers: ['Anthony Edwards', 'Karl-Anthony Towns', 'Rudy Gobert'],
  },
  {
    title: '76ers vs Knicks - Jan 22, 2025',
    homeTeam: 'PHI',
    awayTeam: 'NYK',
    gameDate: '2025-01-22',
    duration: 6960,
    homePlayers: ['Joel Embiid', 'Tyrese Maxey', 'Paul George'],
    awayPlayers: ['Jalen Brunson', 'Julius Randle', 'OG Anunoby'],
  },
  {
    title: 'Mavericks vs Thunder - Mar 1, 2025',
    homeTeam: 'DAL',
    awayTeam: 'OKC',
    gameDate: '2025-03-01',
    duration: 7140,
    homePlayers: ['Luka Doncic', 'Kyrie Irving', 'Daniel Gafford'],
    awayPlayers: ['Shai Gilgeous-Alexander', 'Jalen Williams', 'Chet Holmgren'],
  },
] as const;

const PLAY_TYPES = [
  'pnr_ball_handler',
  'isolation',
  'catch_and_shoot',
  'transition',
  'post_up',
  'off_screen',
  'fastbreak',
  'handoff',
  'cut',
  'putback',
] as const;

const PRIMARY_ACTIONS = [
  'shot_attempt',
  'made_shot',
  'missed_shot',
  'drive',
  'pass',
  'assist',
  'turnover',
  'steal',
  'dunk',
  'layup',
  'three_pointer',
] as const;

const SHOT_RESULTS = ['make', 'miss', 'blocked'] as const;

const POSSESSION_TYPES = ['offense', 'defense'] as const;

// ─── 1. Insert videos ────────────────────────────────────────────────────────

const insertVideoStmt = db.prepare(`
  INSERT INTO videos (title, filename, filepath, duration_seconds, width, height,
                      fps, file_size_bytes, source_type, game_id, game_date,
                      home_team, away_team, season, status, processed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', datetime('now'))
`);

const videoIds: number[] = [];

const insertAllVideos = db.transaction(() => {
  for (const v of VIDEOS) {
    const filename = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.mp4';
    const filepath = path.join(DATA_DIR, filename);
    const gameId = `${v.homeTeam}_${v.awayTeam}_${v.gameDate}`;
    const result = insertVideoStmt.run(
      v.title,
      filename,
      filepath,
      v.duration,
      1920,
      1080,
      30.0,
      randomInt(800_000_000, 2_000_000_000),
      'local',
      gameId,
      v.gameDate,
      v.homeTeam,
      v.awayTeam,
      '2024-25',
    );
    videoIds.push(Number(result.lastInsertRowid));
  }
});

insertAllVideos();
console.log(`Inserted ${videoIds.length} videos.`);

// ─── 2. Insert clips (10 per video = 50 total) ──────────────────────────────

const insertClipStmt = db.prepare(`
  INSERT INTO clips (video_id, title, start_time, end_time, thumbnail_path,
                     quarter, game_clock, shot_clock, score_home, score_away,
                     possession_type, play_type, primary_action, shot_result,
                     primary_player, secondary_player, defender, confidence)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

interface ClipRecord {
  readonly id: number;
  readonly videoIndex: number;
}

const clipRecords: ClipRecord[] = [];

const insertAllClips = db.transaction(() => {
  for (let vi = 0; vi < VIDEOS.length; vi++) {
    const v = VIDEOS[vi];
    const videoId = videoIds[vi];

    // Generate 10 clips spread across the game
    let homeScore = 0;
    let awayScore = 0;

    for (let ci = 0; ci < 10; ci++) {
      // Distribute clips roughly across the game timeline
      const segmentStart = (v.duration / 10) * ci;
      const startTime = segmentStart + randomFloat(10, v.duration / 10 - 30);
      const clipDuration = randomFloat(5, 18);
      const endTime = Math.min(startTime + clipDuration, v.duration);

      // Determine quarter based on position in the game
      const gameProgress = startTime / v.duration;
      let quarter: number;
      if (gameProgress < 0.25) quarter = 1;
      else if (gameProgress < 0.5) quarter = 2;
      else if (gameProgress < 0.75) quarter = 3;
      else if (gameProgress < 0.95) quarter = 4;
      else quarter = 5; // OT

      const clock = gameClock(quarter);

      // Score progresses through the game
      homeScore += randomInt(0, 5);
      awayScore += randomInt(0, 5);

      const playType = PLAY_TYPES[ci % PLAY_TYPES.length];
      const action = pick(PRIMARY_ACTIONS);
      const isShot = ['shot_attempt', 'made_shot', 'missed_shot', 'three_pointer', 'dunk', 'layup'].includes(action);
      const shotResult = isShot ? pick(SHOT_RESULTS) : null;

      // Alternate between home and away possessions
      const isHomePossession = ci % 2 === 0;
      const offensePlayers = isHomePossession ? v.homePlayers : v.awayPlayers;
      const defensePlayers = isHomePossession ? v.awayPlayers : v.homePlayers;

      const primaryPlayer = pick(offensePlayers);
      const secondaryPlayer = offensePlayers.length > 1
        ? pick(offensePlayers.filter(p => p !== primaryPlayer))
        : null;
      const defender = pick(defensePlayers);

      const possessionType = pick(POSSESSION_TYPES);
      const confidence = parseFloat(randomFloat(0.6, 0.95).toFixed(2));
      const shotClock = parseFloat(randomFloat(2, 24).toFixed(1));

      const clipTitle = `${primaryPlayer} - ${playType.replace(/_/g, ' ')} (${action.replace(/_/g, ' ')})`;
      const thumbnailPath = path.join(CLIPS_DIR, `clip_${videoId}_${ci + 1}.jpg`);

      const result = insertClipStmt.run(
        videoId,
        clipTitle,
        parseFloat(startTime.toFixed(2)),
        parseFloat(endTime.toFixed(2)),
        thumbnailPath,
        quarter,
        clock,
        shotClock,
        homeScore,
        awayScore,
        possessionType,
        playType,
        action,
        shotResult,
        primaryPlayer,
        secondaryPlayer,
        defender,
        confidence,
      );
      clipRecords.push({ id: Number(result.lastInsertRowid), videoIndex: vi });
    }
  }
});

insertAllClips();
console.log(`Inserted ${clipRecords.length} clips.`);

// ─── 3. Insert tags and assign to clips ──────────────────────────────────────

interface TagSpec {
  readonly name: string;
  readonly category: string;
}

const ACTION_TAGS: readonly string[] = [
  'dunk', 'three_pointer', 'crossover', 'block', 'steal',
  'fast_break', 'alley_oop', 'step_back', 'poster',
];

const PLAYER_TAGS: readonly string[] = [
  'LeBron James', 'Anthony Davis', "D'Angelo Russell", 'Austin Reaves',
  'Stephen Curry', 'Klay Thompson', 'Draymond Green', 'Andrew Wiggins',
  'Jayson Tatum', 'Jaylen Brown', 'Derrick White', 'Kristaps Porzingis',
  'Giannis Antetokounmpo', 'Damian Lillard', 'Khris Middleton',
  'Nikola Jokic', 'Jamal Murray', 'Michael Porter Jr.', 'Aaron Gordon',
  'Anthony Edwards', 'Karl-Anthony Towns', 'Rudy Gobert',
  'Joel Embiid', 'Tyrese Maxey', 'Paul George',
  'Jalen Brunson', 'Julius Randle', 'OG Anunoby',
  'Luka Doncic', 'Kyrie Irving', 'Daniel Gafford',
  'Shai Gilgeous-Alexander', 'Jalen Williams', 'Chet Holmgren',
];

const TEAM_TAGS: readonly string[] = [
  'LAL', 'GSW', 'BOS', 'MIL', 'DEN', 'MIN', 'PHI', 'NYK', 'DAL', 'OKC',
];

const CONTEXT_TAGS: readonly string[] = [
  'clutch', 'fourth_quarter', 'overtime', 'buzzer_beater', 'playoff_intensity', 'comeback',
];

const QUALITY_TAGS: readonly string[] = [
  'highlight', 'film_worthy', 'coaching_clip', 'defensive_gem',
];

const CUSTOM_TAGS: readonly string[] = [
  'top_10_play', 'must_watch', 'defensive_breakdown',
];

const allTags: readonly TagSpec[] = [
  ...ACTION_TAGS.map(name => ({ name, category: 'action' })),
  ...PLAYER_TAGS.map(name => ({ name, category: 'player' })),
  ...TEAM_TAGS.map(name => ({ name, category: 'team' })),
  ...CONTEXT_TAGS.map(name => ({ name, category: 'context' })),
  ...QUALITY_TAGS.map(name => ({ name, category: 'quality' })),
  ...CUSTOM_TAGS.map(name => ({ name, category: 'custom' })),
];

const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)');
const getTagIdStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
const insertClipTagStmt = db.prepare('INSERT OR IGNORE INTO clip_tags (clip_id, tag_id, confidence) VALUES (?, ?, ?)');

const insertAllTags = db.transaction(() => {
  // Create all tags
  for (const t of allTags) {
    insertTagStmt.run(t.name, t.category);
  }

  // Assign tags to clips
  for (const clipRec of clipRecords) {
    const v = VIDEOS[clipRec.videoIndex];

    // Team tags — both teams in the game
    const homeTagRow = getTagIdStmt.get(v.homeTeam) as { id: number } | undefined;
    const awayTagRow = getTagIdStmt.get(v.awayTeam) as { id: number } | undefined;
    if (homeTagRow) insertClipTagStmt.run(clipRec.id, homeTagRow.id, 1.0);
    if (awayTagRow) insertClipTagStmt.run(clipRec.id, awayTagRow.id, 1.0);

    // Player tag for the primary player on this clip (look it up from the clip)
    const clipRow = db.prepare('SELECT primary_player, play_type, primary_action, quarter FROM clips WHERE id = ?')
      .get(clipRec.id) as { primary_player: string; play_type: string; primary_action: string; quarter: number };

    if (clipRow.primary_player) {
      const playerTagRow = getTagIdStmt.get(clipRow.primary_player) as { id: number } | undefined;
      if (playerTagRow) insertClipTagStmt.run(clipRec.id, playerTagRow.id, 1.0);
    }

    // Action tags — assign relevant action tags based on play type / action
    const actionMap: Record<string, readonly string[]> = {
      fastbreak: ['fast_break'],
      transition: ['fast_break'],
      isolation: ['crossover', 'step_back'],
      pnr_ball_handler: ['crossover'],
      post_up: ['dunk', 'poster'],
      cut: ['alley_oop'],
      putback: ['dunk'],
    };

    const candidateActions = actionMap[clipRow.play_type] ?? [];
    for (const actionTag of candidateActions) {
      if (Math.random() < 0.5) {
        const tagRow = getTagIdStmt.get(actionTag) as { id: number } | undefined;
        if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, parseFloat(randomFloat(0.7, 1.0).toFixed(2)));
      }
    }

    // Direct action-to-tag mapping
    const directActionMap: Record<string, string> = {
      dunk: 'dunk',
      three_pointer: 'three_pointer',
      steal: 'steal',
    };
    const directTag = directActionMap[clipRow.primary_action];
    if (directTag) {
      const tagRow = getTagIdStmt.get(directTag) as { id: number } | undefined;
      if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, 1.0);
    }

    // Context tags
    if (clipRow.quarter === 4) {
      const tagRow = getTagIdStmt.get('fourth_quarter') as { id: number } | undefined;
      if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, 1.0);

      if (Math.random() < 0.3) {
        const clutchRow = getTagIdStmt.get('clutch') as { id: number } | undefined;
        if (clutchRow) insertClipTagStmt.run(clipRec.id, clutchRow.id, 0.85);
      }
    }
    if (clipRow.quarter === 5) {
      const tagRow = getTagIdStmt.get('overtime') as { id: number } | undefined;
      if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, 1.0);
    }

    // Quality tags — sprinkle across clips
    if (Math.random() < 0.35) {
      const qualityTag = pick(QUALITY_TAGS);
      const tagRow = getTagIdStmt.get(qualityTag) as { id: number } | undefined;
      if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, parseFloat(randomFloat(0.8, 1.0).toFixed(2)));
    }

    // Custom tags — rare
    if (Math.random() < 0.15) {
      const customTag = pick(CUSTOM_TAGS);
      const tagRow = getTagIdStmt.get(customTag) as { id: number } | undefined;
      if (tagRow) insertClipTagStmt.run(clipRec.id, tagRow.id, 1.0);
    }
  }
});

insertAllTags();

const totalTags = (db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number }).count;
const totalClipTags = (db.prepare('SELECT COUNT(*) as count FROM clip_tags').get() as { count: number }).count;
console.log(`Inserted ${totalTags} tags with ${totalClipTags} clip-tag associations.`);

// ─── 4. Insert annotations ──────────────────────────────────────────────────

const insertAnnotationStmt = db.prepare(`
  INSERT INTO annotations (clip_id, timestamp, annotation_type, content, x, y)
  VALUES (?, ?, ?, ?, ?, ?)
`);

interface AnnotationTemplate {
  readonly type: 'note' | 'highlight' | 'action';
  readonly templates: readonly string[];
}

const ANNOTATION_TEMPLATES: readonly AnnotationTemplate[] = [
  {
    type: 'note',
    templates: [
      'Great defensive rotation on this play',
      'Watch the off-ball movement here',
      'Weak-side help defense collapses',
      'Perfect spacing for the drive',
      'Ball handler reads the switch correctly',
      'Defender caught on the wrong side of the screen',
      'Double team comes too late on the post-up',
      'Notice the stagger screen timing',
    ],
  },
  {
    type: 'highlight',
    templates: [
      'Elite ball handling under pressure',
      'Textbook pick and roll execution',
      'Incredible court vision on this pass',
      'Explosive first step blows by defender',
      'Posterizing dunk over two defenders',
      'Deep three with a hand in face',
      'Clutch shot late in the 4th',
      'Behind-the-back assist to the corner',
    ],
  },
  {
    type: 'action',
    templates: [
      'Screen set at the elbow',
      'Curl off the pin-down',
      'Ghost screen into pop',
      'Reject screen and attack baseline',
      'Slip to the rim after setting screen',
      'Flare screen for the shooter',
      'Back cut on ball reversal',
      'Drop coverage on the pick and roll',
    ],
  },
];

const insertAllAnnotations = db.transaction(() => {
  // Annotate ~20 clips with 2-3 annotations each
  const clipsToAnnotate = clipRecords.slice(0, 20);

  for (const clipRec of clipsToAnnotate) {
    const clipRow = db.prepare('SELECT start_time, end_time FROM clips WHERE id = ?')
      .get(clipRec.id) as { start_time: number; end_time: number };

    const annotationCount = randomInt(2, 3);

    for (let ai = 0; ai < annotationCount; ai++) {
      const template = pick(ANNOTATION_TEMPLATES);
      const content = pick(template.templates);
      const timestamp = parseFloat(
        randomFloat(clipRow.start_time, clipRow.end_time).toFixed(2),
      );
      // x, y represent positions on the court diagram (0-100 range)
      const x = parseFloat(randomFloat(10, 90).toFixed(1));
      const y = parseFloat(randomFloat(10, 90).toFixed(1));

      insertAnnotationStmt.run(
        clipRec.id,
        timestamp,
        template.type,
        content,
        x,
        y,
      );
    }
  }
});

insertAllAnnotations();

const totalAnnotations = (db.prepare('SELECT COUNT(*) as count FROM annotations').get() as { count: number }).count;
console.log(`Inserted ${totalAnnotations} annotations across 20 clips.`);

// ─── Done ────────────────────────────────────────────────────────────────────

console.log('\nSeed complete! Summary:');
console.log(`  Videos:       ${videoIds.length}`);
console.log(`  Clips:        ${clipRecords.length}`);
console.log(`  Tags:         ${totalTags}`);
console.log(`  Clip-tags:    ${totalClipTags}`);
console.log(`  Annotations:  ${totalAnnotations}`);

db.close();
