"""CLI script to process a single video clip through the pipeline.

Usage:
    python -m scripts.process_clip --input path/to/clip.mp4
    python -m scripts.process_clip --input clip.mp4 --db data/film.db
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import click

# Add parent dir to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ProcessingResult
from pipeline.classify import classify_clip
from pipeline.detect import detect_objects_in_clip
from pipeline.embed import generate_clip_embedding
from pipeline.export import (
    init_film_db,
    insert_clip,
    insert_clip_tags,
)
from pipeline.ingest import ingest_video
from pipeline.segment import segment_video
from pipeline.tag import generate_tags

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@click.command()
@click.option(
    "--input", "input_path",
    required=True,
    type=click.Path(exists=False),
    help="Path to the video clip to process.",
)
@click.option(
    "--db",
    default="data/film.db",
    type=click.Path(),
    help="Path to film.db (default: data/film.db).",
)
@click.option(
    "--game-id",
    default=None,
    help="Optional game identifier.",
)
@click.option(
    "--home-team",
    default=None,
    help="Home team name.",
)
@click.option(
    "--away-team",
    default=None,
    help="Away team name.",
)
def main(
    input_path: str,
    db: str,
    game_id: str | None,
    home_team: str | None,
    away_team: str | None,
) -> None:
    """Process a single video clip through the full ML pipeline."""
    start = time.time()
    video_path = Path(input_path)
    errors: list[str] = []

    config = PipelineConfig(film_db_path=Path(db))
    config.ensure_directories()

    click.echo(f"Initializing film database at {config.film_db_path}...")
    init_film_db(config.film_db_path)

    # Step 1: Ingest
    click.echo(f"Ingesting video: {video_path}")
    if not video_path.exists():
        click.echo(f"WARNING: Video file not found at {video_path}. Proceeding with mock data.")
        errors.append(f"Video file not found: {video_path}")

    video_id, metadata = ingest_video(
        video_path, config, game_id=game_id, home_team=home_team, away_team=away_team,
    )
    click.echo(f"  Video ID: {video_id} | Duration: {metadata.duration:.1f}s | {metadata.width}x{metadata.height}")

    # Step 2: Segment
    click.echo("Segmenting video into clips...")
    segments = segment_video(video_path, config, duration_hint=metadata.duration)
    click.echo(f"  Found {len(segments)} clip segments")

    # Step 3: Process each segment
    clips_classified = 0
    tags_generated = 0

    for i, segment in enumerate(segments):
        click.echo(f"  Processing clip {i + 1}/{len(segments)}: {segment.start_time:.1f}-{segment.end_time:.1f}s")

        # Detect
        detections = detect_objects_in_clip(video_path, segment, config)

        # Classify
        classification = classify_clip(detections, segment.duration, config)
        clips_classified += 1

        # Insert clip into DB
        clip_id = insert_clip(config.film_db_path, video_id, segment, classification)

        # Generate and insert tags
        tags = generate_tags(
            classification, segment, detections,
            home_team=home_team, away_team=away_team,
        )
        count = insert_clip_tags(config.film_db_path, clip_id, tags)
        tags_generated += count

        # Generate embedding (stored in memory for now)
        _embedding = generate_clip_embedding(segment, classification, config, video_id=video_id)

        click.echo(f"    -> {classification.play_type} / {classification.primary_action} (conf={classification.confidence:.2f}, {count} tags)")

    elapsed = time.time() - start

    result = ProcessingResult(
        video_id=video_id,
        clips_found=len(segments),
        clips_classified=clips_classified,
        tags_generated=tags_generated,
        processing_time=round(elapsed, 2),
        errors=errors,
    )

    click.echo("\n--- Processing Complete ---")
    click.echo(f"Video ID:         {result.video_id}")
    click.echo(f"Clips found:      {result.clips_found}")
    click.echo(f"Clips classified: {result.clips_classified}")
    click.echo(f"Tags generated:   {result.tags_generated}")
    click.echo(f"Processing time:  {result.processing_time:.2f}s")
    if result.errors:
        click.echo(f"Errors:           {len(result.errors)}")
        for err in result.errors:
            click.echo(f"  - {err}")


if __name__ == "__main__":
    main()
