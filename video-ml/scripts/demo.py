"""Demo script that generates sample output without requiring real video.

Creates a film.db with realistic sample data so the frontend can be
developed and tested independently of the ML pipeline.

Usage:
    python -m scripts.demo
    python -m scripts.demo --clips 20 --db data/film.db
"""

from __future__ import annotations

import logging
import random
import sys
import time
from pathlib import Path

import click

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment, ProcessingResult
from pipeline.embed import generate_clip_embedding
from pipeline.export import (
    create_processing_job,
    init_film_db,
    insert_clip,
    insert_clip_tags,
    update_processing_job,
    export_to_json,
)
from pipeline.tag import Tag, generate_tags

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Sample data for realistic demos
SAMPLE_PLAYERS = [
    "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo",
    "Luka Doncic", "Jayson Tatum", "Nikola Jokic", "Joel Embiid",
    "Anthony Davis", "Devin Booker", "Ja Morant", "Shai Gilgeous-Alexander",
]

SAMPLE_TEAMS = [
    ("Lakers", "Celtics"), ("Warriors", "Suns"), ("Nuggets", "76ers"),
    ("Bucks", "Heat"), ("Mavericks", "Thunder"), ("Grizzlies", "Timberwolves"),
]


def _generate_sample_clip(
    clip_index: int,
    video_duration: float,
    rng: random.Random,
) -> tuple[ClipSegment, ClassificationResult]:
    """Generate a single realistic sample clip."""
    # Spread clips across the video duration
    max_start = max(0.0, video_duration - 30.0)
    start_time = round(rng.uniform(0, max_start), 2)
    duration = round(rng.uniform(4.0, 20.0), 2)
    end_time = round(min(start_time + duration, video_duration), 2)

    quarter = min(4, (clip_index // 3) + 1)
    minutes = rng.randint(0, 11)
    seconds = rng.randint(0, 59)
    game_clock = f"{minutes}:{seconds:02d}"

    segment = ClipSegment(
        start_time=start_time,
        end_time=end_time,
        confidence=round(rng.uniform(0.5, 0.95), 3),
        quarter=quarter,
        game_clock=game_clock,
    )

    play_type = rng.choice(PipelineConfig.PLAY_TYPES)
    action = rng.choice(PipelineConfig.ACTIONS)
    player = rng.choice(SAMPLE_PLAYERS)

    tags = [play_type, action]
    if rng.random() > 0.5:
        tags.append(rng.choice(["fast_movement", "near_basket", "perimeter", "contested"]))
    if rng.random() > 0.7:
        tags.append(rng.choice(PipelineConfig.SHOT_RESULTS))

    classification = ClassificationResult(
        play_type=play_type,
        primary_action=action,
        primary_player=player,
        confidence=round(rng.uniform(0.4, 0.95), 3),
        tags=tags,
    )

    return segment, classification


@click.command()
@click.option("--clips", default=12, help="Number of sample clips to generate.")
@click.option("--db", default="data/film.db", type=click.Path(), help="Path to film.db.")
@click.option("--export-json", is_flag=True, default=True, help="Export results to JSON.")
@click.option("--seed", default=42, help="Random seed for reproducibility.")
def main(clips: int, db: str, export_json: bool, seed: int) -> None:
    """Generate sample film data for frontend development."""
    start = time.time()
    rng = random.Random(seed)

    config = PipelineConfig(film_db_path=Path(db))
    config.ensure_directories()

    click.echo("=" * 60)
    click.echo("Basketball Film Copilot - Demo Data Generator")
    click.echo("=" * 60)

    init_film_db(config.film_db_path)

    # Create a sample video record
    home_team, away_team = rng.choice(SAMPLE_TEAMS)
    video_duration = rng.uniform(120.0, 600.0)

    import sqlite3
    conn = sqlite3.connect(str(config.film_db_path))
    try:
        cursor = conn.execute(
            """
            INSERT INTO videos (
                title, filename, filepath,
                duration_seconds, width, height, fps, file_size_bytes,
                source_type, game_id, game_date, home_team, away_team, season,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')
            """,
            (
                f"{home_team} vs {away_team} - Demo Game",
                "demo_game.mp4",
                "data/clips/demo_game.mp4",
                round(video_duration, 1),
                1920, 1080, 30.0, int(video_duration * 250000),
                "local",
                f"DEMO-{seed:04d}",
                "2025-03-28",
                home_team,
                away_team,
                "2024-25",
            ),
        )
        conn.commit()
        video_id = cursor.lastrowid
    finally:
        conn.close()

    click.echo(f"\nCreated video: {home_team} vs {away_team} (ID={video_id}, {video_duration:.0f}s)")

    job_id = create_processing_job(config.film_db_path, video_id, "quick")

    # Generate clips
    click.echo(f"\nGenerating {clips} sample clips...")
    total_tags = 0

    for i in range(clips):
        segment, classification = _generate_sample_clip(i, video_duration, rng)

        clip_id = insert_clip(
            config.film_db_path, video_id, segment, classification,
            score_home=rng.randint(80, 120),
            score_away=rng.randint(80, 120),
        )

        classification_with_id = classification.model_copy(update={"clip_id": clip_id})

        tags = generate_tags(
            classification_with_id, segment,
            home_team=home_team, away_team=away_team,
        )
        tag_count = insert_clip_tags(config.film_db_path, clip_id, tags)
        total_tags += tag_count

        _embedding = generate_clip_embedding(segment, classification, config, video_id=video_id)

        click.echo(
            f"  Clip {i + 1:3d}: {segment.start_time:6.1f}-{segment.end_time:6.1f}s | "
            f"Q{segment.quarter} {segment.game_clock} | "
            f"{classification.play_type:15s} | {classification.primary_action:18s} | "
            f"{classification.primary_player}"
        )

    elapsed = time.time() - start
    update_processing_job(
        config.film_db_path, job_id,
        status="completed", progress=1.0,
        result_summary=f"demo: {clips} clips, {total_tags} tags",
    )

    # Export
    if export_json:
        json_path = config.data_dir / f"video_{video_id}_export.json"
        export_to_json(config.film_db_path, json_path, video_id)
        click.echo(f"\nExported to {json_path}")

    result = ProcessingResult(
        video_id=video_id,
        clips_found=clips,
        clips_classified=clips,
        tags_generated=total_tags,
        processing_time=round(elapsed, 2),
    )

    click.echo("\n" + "=" * 60)
    click.echo("Demo Data Generated Successfully")
    click.echo("=" * 60)
    click.echo(f"  Video ID:         {result.video_id}")
    click.echo(f"  Clips:            {result.clips_found}")
    click.echo(f"  Tags:             {result.tags_generated}")
    click.echo(f"  Database:         {config.film_db_path}")
    click.echo(f"  Time:             {result.processing_time:.2f}s")


if __name__ == "__main__":
    main()
