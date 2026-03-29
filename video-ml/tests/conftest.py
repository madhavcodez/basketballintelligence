"""Shared test fixtures for the video-ml test suite."""
from __future__ import annotations
import sys
import sqlite3
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import (
    ClassificationResult, ClipSegment, DetectedObject, DetectionResult,
)
from pipeline.export import init_film_db


@pytest.fixture
def tmp_config(tmp_path):
    """PipelineConfig pointing at temp directories."""
    return PipelineConfig(
        data_dir=tmp_path / "clips",
        film_db_path=tmp_path / "film.db",
        basketball_db_path=tmp_path / "basketball.db",
        temp_dir=tmp_path / "temp",
    )


@pytest.fixture
def film_db(tmp_config):
    """Initialized film.db at a temp path."""
    tmp_config.ensure_directories()
    init_film_db(tmp_config.film_db_path)
    return tmp_config.film_db_path


@pytest.fixture
def basketball_db(tmp_config):
    """A basketball.db with sample shots and player_game_logs tables."""
    db_path = tmp_config.basketball_db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS shots (
            PLAYER_NAME TEXT, PLAYER_ID TEXT, TEAM_NAME TEXT, TEAM_ID TEXT,
            GAME_ID TEXT, GAME_DATE TEXT, PERIOD TEXT, MINS_LEFT TEXT, SECS_LEFT TEXT,
            SHOT_MADE_FLAG INTEGER, ACTION_TYPE TEXT, SHOT_TYPE TEXT,
            SHOT_ZONE_BASIC TEXT, SHOT_DISTANCE TEXT,
            LOC_X TEXT, LOC_Y TEXT, EVENT_TYPE TEXT, season TEXT,
            SEASON_2 TEXT, POSITION TEXT, POSITION_GROUP TEXT,
            HOME_TEAM TEXT, AWAY_TEAM TEXT
        );
        CREATE TABLE IF NOT EXISTS player_game_logs (
            season_year TEXT, game_date TEXT, gameid TEXT, matchup TEXT,
            teamid TEXT, teamcity TEXT, teamname TEXT, teamtricode TEXT,
            teamslug TEXT, personid TEXT, personname TEXT, position TEXT,
            comment TEXT, jerseynum TEXT, minutes TEXT,
            fieldgoalsmade TEXT, fieldgoalsattempted TEXT, fieldgoalspercentage TEXT,
            threepointersmade TEXT, threepointersattempted TEXT, threepointerspercentage TEXT,
            freethrowsmade TEXT, freethrowsattempted TEXT, freethrowspercentage TEXT,
            reboundsoffensive TEXT, reboundsdefensive TEXT, reboundstotal TEXT,
            assists TEXT, steals TEXT, blocks TEXT, turnovers TEXT,
            foulspersonal TEXT, points TEXT, plusminuspoints TEXT
        );
        INSERT INTO shots (PLAYER_NAME, GAME_ID, PERIOD, MINS_LEFT, SECS_LEFT, SHOT_MADE_FLAG, ACTION_TYPE)
        VALUES ('LeBron James', 'G001', '1', '8', '42', 1, 'Layup');
        INSERT INTO shots (PLAYER_NAME, GAME_ID, PERIOD, MINS_LEFT, SECS_LEFT, SHOT_MADE_FLAG, ACTION_TYPE)
        VALUES ('Stephen Curry', 'G001', '1', '6', '15', 0, '3PT');
        INSERT INTO shots (PLAYER_NAME, GAME_ID, PERIOD, MINS_LEFT, SECS_LEFT, SHOT_MADE_FLAG, ACTION_TYPE)
        VALUES ('LeBron James', 'G001', '2', '3', '30', 1, 'Dunk');
        INSERT INTO player_game_logs (gameid, personid, personname, points, assists)
        VALUES ('G001', '2544', 'LeBron James', '30', '10');
        INSERT INTO player_game_logs (gameid, personid, personname, points, assists)
        VALUES ('G001', '201939', 'Stephen Curry', '28', '6');
    """)
    conn.commit()
    conn.close()
    return db_path


@pytest.fixture
def sample_segment():
    """A typical clip segment."""
    return ClipSegment(start_time=10.0, end_time=20.0, confidence=0.8, quarter=1, game_clock="8:42")


@pytest.fixture
def sample_classification():
    """A typical classification result."""
    return ClassificationResult(
        play_type="isolation",
        primary_action="drive",
        primary_player="LeBron James",
        confidence=0.75,
        tags=["isolation", "drive"],
    )


@pytest.fixture
def sample_detections():
    """A list of detection results for testing."""
    results = []
    for i in range(5):
        objects = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.1, 0.2, 0.15, 0.4)),
            DetectedObject(label="player", confidence=0.85, bbox=(0.3, 0.2, 0.35, 0.4)),
            DetectedObject(label="player", confidence=0.88, bbox=(0.5, 0.2, 0.55, 0.4)),
            DetectedObject(label="ball", confidence=0.7, bbox=(0.4, 0.3, 0.42, 0.32)),
            DetectedObject(label="hoop", confidence=0.55, bbox=(0.45, 0.03, 0.5, 0.1)),
        ]
        results.append(DetectionResult(
            frame_number=i * 15,
            timestamp=i * 0.5,
            objects=objects,
            court_detected=True,
        ))
    return results
