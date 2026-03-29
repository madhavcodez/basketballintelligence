"""Tests for the video ingestion module."""
from __future__ import annotations
import sys
import sqlite3
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import VideoMetadata
from pipeline.ingest import (
    extract_metadata,
    create_video_record,
    update_video_status,
    ingest_video,
)
from pipeline.export import init_film_db


class TestExtractMetadata:
    def test_returns_video_metadata(self, tmp_path):
        fake = tmp_path / "test.mp4"
        fake.write_bytes(b"\x00" * 100)
        meta = extract_metadata(fake)
        assert isinstance(meta, VideoMetadata)

    def test_title_from_filename(self, tmp_path):
        fake = tmp_path / "my_game.mp4"
        fake.write_bytes(b"\x00" * 100)
        meta = extract_metadata(fake)
        assert meta.title == "my_game"

    def test_file_size_populated(self, tmp_path):
        fake = tmp_path / "vid.mp4"
        fake.write_bytes(b"\x00" * 500)
        meta = extract_metadata(fake)
        assert meta.file_size == 500

    def test_source_type_is_local(self, tmp_path):
        fake = tmp_path / "game.mp4"
        fake.write_bytes(b"\x00" * 100)
        meta = extract_metadata(fake)
        assert meta.source_type == "local"


class TestCreateVideoRecord:
    def test_returns_positive_id(self, film_db):
        meta = VideoMetadata(title="test", duration=60.0, width=1920, height=1080, fps=30.0)
        vid_id = create_video_record(film_db, Path("test.mp4"), meta)
        assert vid_id > 0

    def test_record_inserted(self, film_db):
        meta = VideoMetadata(title="test", duration=120.0)
        vid_id = create_video_record(film_db, Path("game.mp4"), meta)
        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT title, duration_seconds FROM videos WHERE id = ?", (vid_id,)).fetchone()
        conn.close()
        assert row[0] == "test"
        assert row[1] == 120.0

    def test_game_metadata_stored(self, film_db):
        meta = VideoMetadata(title="playoff")
        vid_id = create_video_record(
            film_db, Path("g.mp4"), meta,
            game_id="G999", home_team="Lakers", away_team="Celtics",
        )
        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT game_id, home_team, away_team FROM videos WHERE id = ?", (vid_id,)).fetchone()
        conn.close()
        assert row == ("G999", "Lakers", "Celtics")


class TestUpdateVideoStatus:
    def test_updates_status(self, film_db):
        meta = VideoMetadata(title="t")
        vid_id = create_video_record(film_db, Path("v.mp4"), meta)
        update_video_status(film_db, vid_id, "ready")
        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT status FROM videos WHERE id = ?", (vid_id,)).fetchone()
        conn.close()
        assert row[0] == "ready"


class TestIngestVideo:
    def test_returns_tuple(self, tmp_config):
        tmp_config.ensure_directories()
        init_film_db(tmp_config.film_db_path)
        fake = tmp_config.data_dir / "test.mp4"
        fake.parent.mkdir(parents=True, exist_ok=True)
        fake.write_bytes(b"\x00" * 200)
        vid_id, meta = ingest_video(fake, tmp_config)
        assert vid_id > 0
        assert isinstance(meta, VideoMetadata)
