"""Export pipeline results to SQLite (film.db) and JSON for frontend consumption.

Initializes the film.db schema and writes clips, tags, and annotations.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment, ProcessingResult
from pipeline.tag import Tag

logger = logging.getLogger(__name__)

FILM_DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, filename TEXT NOT NULL, filepath TEXT NOT NULL,
  duration_seconds REAL, width INTEGER, height INTEGER, fps REAL, file_size_bytes INTEGER,
  source_type TEXT CHECK(source_type IN ('upload', 'youtube', 'local', 'stream')),
  source_url TEXT, game_id TEXT, game_date TEXT, home_team TEXT, away_team TEXT, season TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT, processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  title TEXT, start_time REAL NOT NULL, end_time REAL NOT NULL,
  duration REAL GENERATED ALWAYS AS (end_time - start_time) STORED,
  thumbnail_path TEXT, quarter INTEGER, game_clock TEXT, shot_clock REAL,
  score_home INTEGER, score_away INTEGER,
  possession_type TEXT, play_type TEXT, primary_action TEXT, shot_result TEXT,
  primary_player TEXT, secondary_player TEXT, defender TEXT,
  player_game_log_id TEXT, shot_id TEXT,
  confidence REAL DEFAULT 0.0, manually_verified INTEGER DEFAULT 0,
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
  content TEXT NOT NULL, x REAL, y REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  job_type TEXT CHECK(job_type IN ('quick', 'deep', 'align')),
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
  progress REAL DEFAULT 0.0,
  started_at TEXT, completed_at TEXT, error_message TEXT, result_summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id);
CREATE INDEX IF NOT EXISTS idx_clips_player ON clips(primary_player);
CREATE INDEX IF NOT EXISTS idx_clips_play_type ON clips(play_type);
CREATE INDEX IF NOT EXISTS idx_clips_action ON clips(primary_action);
CREATE INDEX IF NOT EXISTS idx_clip_tags_clip ON clip_tags(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_tags_tag ON clip_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_annotations_clip ON annotations(clip_id);
"""


def init_film_db(db_path: Path) -> None:
    """Initialize the film.db schema. Safe to call multiple times."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    try:
        conn.executescript(FILM_DB_SCHEMA)
        conn.commit()
        logger.info("Film DB initialized at %s", db_path)
    finally:
        conn.close()


def insert_clip(
    db_path: Path,
    video_id: int,
    segment: ClipSegment,
    classification: ClassificationResult | None = None,
    *,
    thumbnail_path: str | None = None,
    score_home: int | None = None,
    score_away: int | None = None,
) -> int:
    """Insert a clip record and return its id."""
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(
            """
            INSERT INTO clips (
                video_id, title, start_time, end_time,
                thumbnail_path, quarter, game_clock,
                score_home, score_away,
                play_type, primary_action, primary_player,
                confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id,
                f"Clip {segment.start_time:.1f}-{segment.end_time:.1f}s",
                segment.start_time,
                segment.end_time,
                thumbnail_path,
                segment.quarter,
                segment.game_clock,
                score_home,
                score_away,
                classification.play_type if classification else None,
                classification.primary_action if classification else None,
                classification.primary_player if classification else None,
                classification.confidence if classification else 0.0,
            ),
        )
        conn.commit()
        clip_id = cursor.lastrowid
        if clip_id is None:
            raise RuntimeError("Failed to insert clip record")
        return clip_id
    finally:
        conn.close()


def _get_or_create_tag(conn: sqlite3.Connection, name: str, category: str) -> int:
    """Get existing tag id or create a new one."""
    row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
    if row:
        return row[0]

    cursor = conn.execute(
        "INSERT INTO tags (name, category) VALUES (?, ?)",
        (name, category),
    )
    tag_id = cursor.lastrowid
    if tag_id is None:
        raise RuntimeError(f"Failed to create tag: {name}")
    return tag_id


def insert_clip_tags(
    db_path: Path,
    clip_id: int,
    tags: list[Tag],
) -> int:
    """Insert tags for a clip. Returns number of tags linked."""
    conn = sqlite3.connect(str(db_path))
    count = 0
    try:
        for tag in tags:
            tag_id = _get_or_create_tag(conn, tag.name, tag.category)
            conn.execute(
                """
                INSERT OR IGNORE INTO clip_tags (clip_id, tag_id, confidence)
                VALUES (?, ?, ?)
                """,
                (clip_id, tag_id, tag.confidence),
            )
            count += 1
        conn.commit()
    finally:
        conn.close()

    return count


def create_processing_job(
    db_path: Path,
    video_id: int,
    job_type: str = "quick",
) -> int:
    """Create a processing job record and return its id."""
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(
            """
            INSERT INTO processing_jobs (video_id, job_type, status, started_at)
            VALUES (?, ?, 'running', datetime('now'))
            """,
            (video_id, job_type),
        )
        conn.commit()
        job_id = cursor.lastrowid
        if job_id is None:
            raise RuntimeError("Failed to create processing job")
        return job_id
    finally:
        conn.close()


def update_processing_job(
    db_path: Path,
    job_id: int,
    *,
    status: str | None = None,
    progress: float | None = None,
    error_message: str | None = None,
    result_summary: str | None = None,
) -> None:
    """Update a processing job's status and progress."""
    updates: list[str] = []
    params: list[object] = []

    if status is not None:
        updates.append("status = ?")
        params.append(status)
        if status in ("completed", "failed"):
            updates.append("completed_at = datetime('now')")
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if error_message is not None:
        updates.append("error_message = ?")
        params.append(error_message)
    if result_summary is not None:
        updates.append("result_summary = ?")
        params.append(result_summary)

    if not updates:
        return

    params.append(job_id)
    sql = f"UPDATE processing_jobs SET {', '.join(updates)} WHERE id = ?"

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def export_to_json(
    db_path: Path,
    output_path: Path,
    video_id: int,
) -> Path:
    """Export all clips and tags for a video to a JSON file.

    Useful for frontend consumption or debugging.
    """
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
        if not video_row:
            raise ValueError(f"Video id {video_id} not found")

        clip_rows = conn.execute(
            "SELECT * FROM clips WHERE video_id = ? ORDER BY start_time",
            (video_id,),
        ).fetchall()

        clips_data = []
        for clip_row in clip_rows:
            clip_dict = dict(clip_row)
            clip_id = clip_dict["id"]

            tag_rows = conn.execute(
                """
                SELECT t.name, t.category, ct.confidence
                FROM clip_tags ct
                JOIN tags t ON t.id = ct.tag_id
                WHERE ct.clip_id = ?
                """,
                (clip_id,),
            ).fetchall()

            clip_dict["tags"] = [
                {"name": r["name"], "category": r["category"], "confidence": r["confidence"]}
                for r in tag_rows
            ]
            clips_data.append(clip_dict)

        result = {
            "video": dict(video_row),
            "clips": clips_data,
            "clip_count": len(clips_data),
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2, default=str))
        logger.info("Exported video %d to %s (%d clips)", video_id, output_path, len(clips_data))
        return output_path
    finally:
        conn.close()
