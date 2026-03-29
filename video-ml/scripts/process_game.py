"""CLI script to process a full game video through the pipeline.

Usage:
    python -m scripts.process_game --input path/to/game.mp4
    python -m scripts.process_game --input game.mp4 --home-team "Lakers" --away-team "Celtics"
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import click

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ProcessingResult
from pipeline.classify import classify_clip
from pipeline.detect import detect_objects_in_clip
from pipeline.embed import generate_batch_embeddings
from pipeline.export import (
    create_processing_job,
    export_to_json,
    init_film_db,
    insert_clip,
    insert_clip_tags,
    update_processing_job,
)
from pipeline.ingest import ingest_video, update_video_status
from pipeline.link import link_all_clips
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
    help="Path to the game video.",
)
@click.option("--db", default="data/film.db", type=click.Path(), help="Path to film.db.")
@click.option("--game-id", default=None, help="Game identifier (e.g. NBA game ID).")
@click.option("--game-date", default=None, help="Game date (YYYY-MM-DD).")
@click.option("--home-team", default=None, help="Home team name.")
@click.option("--away-team", default=None, help="Away team name.")
@click.option("--season", default=None, help="Season (e.g. 2024-25).")
@click.option("--export-json", is_flag=True, help="Export results to JSON after processing.")
@click.option("--job-type", default="quick", type=click.Choice(["quick", "deep"]), help="Processing depth.")
def main(
    input_path: str,
    db: str,
    game_id: str | None,
    game_date: str | None,
    home_team: str | None,
    away_team: str | None,
    season: str | None,
    export_json: bool,
    job_type: str,
) -> None:
    """Process a full game video through the ML pipeline."""
    start = time.time()
    video_path = Path(input_path)
    errors: list[str] = []

    config = PipelineConfig(film_db_path=Path(db))
    config.ensure_directories()

    click.echo("=" * 60)
    click.echo("Basketball Film Copilot - Game Processor")
    click.echo("=" * 60)

    # Initialize DB
    click.echo(f"\nInitializing database at {config.film_db_path}...")
    init_film_db(config.film_db_path)

    # Ingest
    click.echo(f"\n[1/6] Ingesting: {video_path}")
    if not video_path.exists():
        click.echo(f"  WARNING: File not found. Using mock metadata.")
        errors.append(f"Video file not found: {video_path}")

    video_id, metadata = ingest_video(
        video_path, config,
        game_id=game_id, game_date=game_date,
        home_team=home_team, away_team=away_team, season=season,
    )
    update_video_status(config.film_db_path, video_id, "processing")
    job_id = create_processing_job(config.film_db_path, video_id, job_type)

    click.echo(f"  Video ID: {video_id} | Job ID: {job_id}")
    click.echo(f"  {metadata.width}x{metadata.height} @ {metadata.fps}fps | {metadata.duration:.1f}s")

    # Segment
    click.echo(f"\n[2/6] Segmenting video...")
    segments = segment_video(video_path, config, duration_hint=metadata.duration)
    click.echo(f"  Found {len(segments)} segments")
    update_processing_job(config.film_db_path, job_id, progress=0.2)

    # Detect + Classify + Tag
    click.echo(f"\n[3/6] Detecting, classifying, and tagging {len(segments)} clips...")
    all_classifications = []
    total_tags = 0

    for i, segment in enumerate(segments):
        progress = 0.2 + (0.6 * (i / max(len(segments), 1)))
        update_processing_job(config.film_db_path, job_id, progress=round(progress, 2))

        detections = detect_objects_in_clip(video_path, segment, config)
        classification = classify_clip(detections, segment.duration, config)
        all_classifications.append(classification)

        clip_id = insert_clip(config.film_db_path, video_id, segment, classification)
        classification_with_id = classification.model_copy(update={"clip_id": clip_id})

        tags = generate_tags(
            classification_with_id, segment, detections,
            home_team=home_team, away_team=away_team,
        )
        tag_count = insert_clip_tags(config.film_db_path, clip_id, tags)
        total_tags += tag_count

        if (i + 1) % 5 == 0 or i == len(segments) - 1:
            click.echo(f"  Processed {i + 1}/{len(segments)} clips")

    # Embeddings
    click.echo(f"\n[4/6] Generating embeddings...")
    _embeddings = generate_batch_embeddings(
        segments, all_classifications, config, video_id=video_id,
    )
    click.echo(f"  Generated {len(_embeddings)} embeddings (dim={config.embedding_dim})")
    update_processing_job(config.film_db_path, job_id, progress=0.9)

    # Cross-database linking
    click.echo(f"\n[5/6] Linking clips to basketball.db...")
    link_summary = link_all_clips(video_id, config)
    click.echo(
        f"  Shots linked: {link_summary.shots_linked}/{link_summary.total_clips} | "
        f"Game logs linked: {link_summary.game_logs_linked}/{link_summary.total_clips}"
    )
    update_processing_job(config.film_db_path, job_id, progress=0.95)

    # Finalize
    click.echo(f"\n[6/6] Finalizing...")
    update_video_status(config.film_db_path, video_id, "ready")
    elapsed = time.time() - start

    result_summary = (
        f"clips={len(segments)}, classified={len(all_classifications)}, "
        f"tags={total_tags}, time={elapsed:.1f}s"
    )
    update_processing_job(
        config.film_db_path, job_id,
        status="completed", progress=1.0, result_summary=result_summary,
    )

    # Optional JSON export
    if export_json:
        json_path = config.data_dir / f"video_{video_id}_export.json"
        export_to_json(config.film_db_path, json_path, video_id)
        click.echo(f"  Exported to {json_path}")

    # Summary
    result = ProcessingResult(
        video_id=video_id,
        clips_found=len(segments),
        clips_classified=len(all_classifications),
        tags_generated=total_tags,
        processing_time=round(elapsed, 2),
        errors=errors,
    )

    click.echo("\n" + "=" * 60)
    click.echo("Processing Complete")
    click.echo("=" * 60)
    click.echo(f"  Video ID:         {result.video_id}")
    click.echo(f"  Clips found:      {result.clips_found}")
    click.echo(f"  Clips classified: {result.clips_classified}")
    click.echo(f"  Tags generated:   {result.tags_generated}")
    click.echo(f"  Processing time:  {result.processing_time:.2f}s")
    if result.errors:
        click.echo(f"  Warnings:         {len(result.errors)}")
        for err in result.errors:
            click.echo(f"    - {err}")


if __name__ == "__main__":
    main()
