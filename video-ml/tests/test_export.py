"""Tests for the export module (film.db operations)."""
from __future__ import annotations
import json
import sys
import sqlite3
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment
from pipeline.export import (
    init_film_db,
    insert_clip,
    insert_clip_tags,
    create_processing_job,
    update_processing_job,
    export_to_json,
)
from pipeline.tag import Tag


class TestInitFilmDb:
    def test_creates_tables(self, tmp_path):
        db = tmp_path / "test.db"
        init_film_db(db)
        conn = sqlite3.connect(str(db))
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        conn.close()
        assert "videos" in tables
        assert "clips" in tables
        assert "tags" in tables
        assert "clip_tags" in tables

    def test_idempotent(self, tmp_path):
        db = tmp_path / "test.db"
        init_film_db(db)
        init_film_db(db)  # Should not raise


class TestInsertClip:
    def test_returns_positive_id(self, film_db):
        # Need a video first
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.commit()
        conn.close()

        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        cls = ClassificationResult(play_type="isolation", primary_action="drive", confidence=0.7)
        clip_id = insert_clip(film_db, 1, seg, cls)
        assert clip_id > 0

    def test_classification_stored(self, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.commit()
        conn.close()

        seg = ClipSegment(start_time=5, end_time=15, confidence=0.6)
        cls = ClassificationResult(play_type="transition", primary_action="layup", confidence=0.8)
        clip_id = insert_clip(film_db, 1, seg, cls)

        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT play_type, primary_action FROM clips WHERE id = ?", (clip_id,)).fetchone()
        conn.close()
        assert row == ("transition", "layup")


class TestInsertClipTags:
    def test_returns_tag_count(self, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.execute("INSERT INTO clips (video_id, start_time, end_time) VALUES (1, 0, 10)")
        conn.commit()
        conn.close()

        tags = [
            Tag(name="isolation", category="action", confidence=0.8),
            Tag(name="Lakers", category="team", confidence=0.9),
        ]
        count = insert_clip_tags(film_db, 1, tags)
        assert count == 2

    def test_tags_retrievable(self, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.execute("INSERT INTO clips (video_id, start_time, end_time) VALUES (1, 0, 10)")
        conn.commit()
        conn.close()

        tags = [Tag(name="drive", category="action")]
        insert_clip_tags(film_db, 1, tags)

        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT name, category FROM tags WHERE name = 'drive'").fetchone()
        conn.close()
        assert row == ("drive", "action")


class TestProcessingJob:
    def test_create_returns_id(self, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.commit()
        conn.close()
        job_id = create_processing_job(film_db, 1)
        assert job_id > 0

    def test_update_progress(self, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('t', 'f', 'p')")
        conn.commit()
        conn.close()
        job_id = create_processing_job(film_db, 1)
        update_processing_job(film_db, job_id, progress=0.5)
        conn = sqlite3.connect(str(film_db))
        row = conn.execute("SELECT progress FROM processing_jobs WHERE id = ?", (job_id,)).fetchone()
        conn.close()
        assert row[0] == 0.5


class TestExportToJson:
    def test_creates_json_file(self, film_db, tmp_path):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('game', 'g.mp4', '/g.mp4')")
        conn.execute("INSERT INTO clips (video_id, start_time, end_time, play_type) VALUES (1, 0, 10, 'isolation')")
        conn.commit()
        conn.close()

        out = tmp_path / "export.json"
        export_to_json(film_db, out, 1)
        assert out.exists()
        data = json.loads(out.read_text())
        assert data["clip_count"] == 1
