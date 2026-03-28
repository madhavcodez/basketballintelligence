"""Video ingestion: extract metadata, create DB record.

Handles video file discovery, metadata extraction via ffprobe (with graceful
fallback), and inserting the initial record into film.db.
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from config import PipelineConfig
from models.schemas import VideoMetadata
from utils.ffmpeg import get_video_metadata


def extract_metadata(video_path: Path) -> VideoMetadata:
    """Extract metadata from a video file.

    Uses ffprobe when available, falls back to OpenCV, then to mock data.
    """
    raw = get_video_metadata(str(video_path))

    return VideoMetadata(
        title=video_path.stem,
        duration=raw.get("duration", 0.0),
        width=raw.get("width", 0),
        height=raw.get("height", 0),
        fps=raw.get("fps", 0.0),
        file_size=video_path.stat().st_size if video_path.exists() else 0,
        source_type="local",
    )


def create_video_record(
    db_path: Path,
    video_path: Path,
    metadata: VideoMetadata,
    *,
    game_id: str | None = None,
    game_date: str | None = None,
    home_team: str | None = None,
    away_team: str | None = None,
    season: str | None = None,
    source_url: str | None = None,
) -> int:
    """Insert a video record into film.db and return the new video id."""
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(
            """
            INSERT INTO videos (
                title, filename, filepath,
                duration_seconds, width, height, fps, file_size_bytes,
                source_type, source_url,
                game_id, game_date, home_team, away_team, season,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """,
            (
                metadata.title,
                video_path.name,
                str(video_path),
                metadata.duration,
                metadata.width,
                metadata.height,
                metadata.fps,
                metadata.file_size,
                metadata.source_type,
                source_url,
                game_id,
                game_date,
                home_team,
                away_team,
                season,
            ),
        )
        conn.commit()
        video_id = cursor.lastrowid
        if video_id is None:
            raise RuntimeError("Failed to insert video record")
        return video_id
    finally:
        conn.close()


def update_video_status(
    db_path: Path,
    video_id: int,
    status: str,
    *,
    error_message: str | None = None,
) -> None:
    """Update the processing status of a video record."""
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            """
            UPDATE videos
            SET status = ?, error_message = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (status, error_message, video_id),
        )
        conn.commit()
    finally:
        conn.close()


def ingest_video(
    video_path: Path,
    config: PipelineConfig | None = None,
    *,
    game_id: str | None = None,
    game_date: str | None = None,
    home_team: str | None = None,
    away_team: str | None = None,
    season: str | None = None,
) -> tuple[int, VideoMetadata]:
    """Full ingestion pipeline: extract metadata and create DB record.

    Returns (video_id, metadata).
    """
    if config is None:
        config = PipelineConfig()

    config.ensure_directories()

    metadata = extract_metadata(video_path)

    video_id = create_video_record(
        config.film_db_path,
        video_path,
        metadata,
        game_id=game_id,
        game_date=game_date,
        home_team=home_team,
        away_team=away_team,
        season=season,
    )

    return video_id, metadata
