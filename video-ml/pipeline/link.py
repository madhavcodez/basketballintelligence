"""Cross-database linking: connect film.db clips to basketball.db stats.

Matches video clips to shot records and player game logs using
game identity, quarter/period, game clock proximity, and player name.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from config import PipelineConfig

logger = logging.getLogger(__name__)

# Maximum seconds of game-clock difference to accept a shot match.
# An NBA possession is 24 s max; OCR clock readings can drift by a few seconds.
_CLOCK_TOLERANCE_SECS = 8.0

# Minimum fuzzy-match ratio to accept a player name match.
_NAME_MATCH_THRESHOLD = 0.65


# ---------------------------------------------------------------------------
# Data transfer objects
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LinkSummary:
    """Counts returned by link_all_clips."""

    total_clips: int
    shots_linked: int
    game_logs_linked: int
    shots_unmatched: int
    game_logs_unmatched: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_game_clock_to_seconds(clock: str | None) -> float:
    """Parse a game-clock string like '8:42' or '0:03' to total seconds.

    Returns 0.0 on unparseable input rather than raising.
    """
    if not clock:
        return 0.0
    try:
        parts = clock.strip().split(":")
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = int(parts[1])
            return float(minutes * 60 + seconds)
        # Fallback: bare number treated as seconds
        return float(clock)
    except (ValueError, IndexError):
        logger.debug("Could not parse game clock '%s'", clock)
        return 0.0


def _fuzzy_name_match(name_a: str, name_b: str) -> float:
    """Return a similarity ratio (0-1) for two player names.

    Comparison is case-insensitive.  Handles partial last-name matches
    gracefully via SequenceMatcher.
    """
    if not name_a or not name_b:
        return 0.0
    return SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()


# ---------------------------------------------------------------------------
# Single-clip linkers (in-memory matching)
# ---------------------------------------------------------------------------

def _match_clip_to_shot(
    clip_quarter: int | None,
    clip_game_clock: str | None,
    shots_for_game: list[sqlite3.Row],
) -> str | None:
    """Find the best matching shot for a clip from pre-fetched shots.

    Returns the shot's rowid as string, or None.
    """
    if clip_quarter is None or clip_game_clock is None:
        return None

    clip_secs = _parse_game_clock_to_seconds(clip_game_clock)
    quarter_str = str(clip_quarter)

    best_rowid: int | None = None
    best_diff = float("inf")

    for row in shots_for_game:
        if row["PERIOD"] != quarter_str:
            continue
        shot_secs = float(row["MINS_LEFT"]) * 60.0 + float(row["SECS_LEFT"])
        diff = abs(clip_secs - shot_secs)
        if diff < best_diff:
            best_diff = diff
            best_rowid = row["rowid"]

    if best_rowid is not None and best_diff <= _CLOCK_TOLERANCE_SECS:
        return str(best_rowid)

    return None


def _match_clip_to_game_log(
    player_name: str | None,
    logs_for_game: list[sqlite3.Row],
) -> str | None:
    """Find a matching game log row from pre-fetched logs.

    Returns a composite key 'personid:gameid' or None.
    """
    if not player_name:
        return None

    best_row: sqlite3.Row | None = None
    best_ratio = 0.0

    for row in logs_for_game:
        ratio = _fuzzy_name_match(player_name, row["personname"])
        if ratio > best_ratio:
            best_ratio = ratio
            best_row = row

    if best_row is not None and best_ratio >= _NAME_MATCH_THRESHOLD:
        return f"{best_row['personid']}:{best_row['gameid']}"

    return None


# ---------------------------------------------------------------------------
# Public helpers (kept for backwards compatibility / direct use)
# ---------------------------------------------------------------------------

def link_clip_to_shot(
    clip_quarter: int | None,
    clip_game_clock: str | None,
    game_id: str,
    basketball_db: Path,
) -> str | None:
    """Find the best matching shot_id in basketball.db for a clip."""
    if clip_quarter is None or clip_game_clock is None:
        return None

    with closing(sqlite3.connect(str(basketball_db))) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT rowid, PERIOD, MINS_LEFT, SECS_LEFT FROM shots WHERE GAME_ID = ?",
            (game_id,),
        ).fetchall()

    return _match_clip_to_shot(clip_quarter, clip_game_clock, rows)


def link_clip_to_game_log(
    player_name: str | None,
    game_id: str,
    basketball_db: Path,
) -> str | None:
    """Find a matching player_game_logs row for a clip's primary player."""
    if not player_name:
        return None

    with closing(sqlite3.connect(str(basketball_db))) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT personid, personname, gameid FROM player_game_logs WHERE gameid = ?",
            (game_id,),
        ).fetchall()

    return _match_clip_to_game_log(player_name, rows)


# ---------------------------------------------------------------------------
# Batch linker
# ---------------------------------------------------------------------------

def link_all_clips(
    video_id: int,
    config: PipelineConfig | None = None,
) -> LinkSummary:
    """Link every clip for *video_id* to basketball.db statistics.

    Fetches all shots and game logs for the game_id once, then matches
    in-memory per clip. Uses a single connection to film.db for reads
    and the batch write.

    Returns a LinkSummary with match/unmatch counts.
    """
    if config is None:
        config = PipelineConfig()

    film_db = config.film_db_path
    basketball_db = config.basketball_db_path

    _empty = LinkSummary(
        total_clips=0, shots_linked=0, game_logs_linked=0,
        shots_unmatched=0, game_logs_unmatched=0,
    )

    # ------ read video + clips from film.db in one connection ------
    with closing(sqlite3.connect(str(film_db))) as film_conn:
        film_conn.row_factory = sqlite3.Row

        video_row = film_conn.execute(
            "SELECT game_id FROM videos WHERE id = ?",
            (video_id,),
        ).fetchone()

        if video_row is None:
            logger.warning("Video id %d not found in film.db", video_id)
            return _empty

        game_id: str | None = video_row["game_id"]
        if not game_id:
            logger.info(
                "Video id %d has no game_id; skipping cross-db linking", video_id,
            )
            return _empty

        clip_rows = film_conn.execute(
            """
            SELECT id, quarter, game_clock, primary_player
            FROM clips
            WHERE video_id = ?
            ORDER BY start_time
            """,
            (video_id,),
        ).fetchall()

    total = len(clip_rows)
    if total == 0:
        logger.info("No clips found for video_id=%d", video_id)
        return _empty

    # ------ pre-fetch all shots + game logs for this game_id ------
    with closing(sqlite3.connect(str(basketball_db))) as bball_conn:
        bball_conn.row_factory = sqlite3.Row
        all_shots = bball_conn.execute(
            "SELECT rowid, PERIOD, MINS_LEFT, SECS_LEFT FROM shots WHERE GAME_ID = ?",
            (game_id,),
        ).fetchall()
        all_logs = bball_conn.execute(
            "SELECT personid, personname, gameid FROM player_game_logs WHERE gameid = ?",
            (game_id,),
        ).fetchall()

    # ------ match each clip in-memory ------
    shots_linked = 0
    game_logs_linked = 0
    updates: list[tuple[str | None, str | None, int]] = []

    for clip in clip_rows:
        shot_id = _match_clip_to_shot(
            clip_quarter=clip["quarter"],
            clip_game_clock=clip["game_clock"],
            shots_for_game=all_shots,
        )

        game_log_id = _match_clip_to_game_log(
            player_name=clip["primary_player"],
            logs_for_game=all_logs,
        )

        if shot_id is not None:
            shots_linked += 1
        if game_log_id is not None:
            game_logs_linked += 1

        updates.append((shot_id, game_log_id, clip["id"]))

    # ------ batch-write updates ------
    with closing(sqlite3.connect(str(film_db))) as film_conn:
        film_conn.executemany(
            """
            UPDATE clips
            SET shot_id = ?, player_game_log_id = ?
            WHERE id = ?
            """,
            updates,
        )
        film_conn.commit()

    summary = LinkSummary(
        total_clips=total,
        shots_linked=shots_linked,
        game_logs_linked=game_logs_linked,
        shots_unmatched=total - shots_linked,
        game_logs_unmatched=total - game_logs_linked,
    )

    logger.info(
        "Linking complete for video_id=%d: %d/%d shots, %d/%d game_logs",
        video_id,
        shots_linked,
        total,
        game_logs_linked,
        total,
    )

    return summary
