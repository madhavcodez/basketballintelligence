# INSTANCE 4: Video Intelligence Architecture + Clip Analysis Prototype

## Mission

Build the foundation for a Basketball Film Copilot — a system where video clips become searchable, tagged, stat-linked basketball intelligence. Tonight we build the architecture: ingestion pipeline, scene segmentation, basic event tagging, clip storage schema, and a Film Browser UI. We're NOT trying to do full computer vision tonight — we're building the skeleton that makes everything else possible.

## Time Budget: 6 hours autonomous

## File Ownership (NO other instance touches these)

### NEW files this instance creates:
```
# Python ML Pipeline
video-ml/
  README.md                          — Pipeline documentation
  requirements.txt                   — Python dependencies
  pyproject.toml                     — Project config
  config.py                          — Pipeline configuration
  pipeline/
    __init__.py
    ingest.py                        — Video ingestion (download, metadata)
    segment.py                       — Scene/possession detection
    detect.py                        — Basic object detection (court, ball, players)
    classify.py                      — Event/action classification
    align.py                         — Sync with play-by-play / game logs
    tag.py                           — Auto-tagging engine
    embed.py                         — Clip embedding generation
    export.py                        — Export to SQLite / JSON for frontend
  models/
    __init__.py
    schemas.py                       — Pydantic models for all data types
  utils/
    __init__.py
    ffmpeg.py                        — FFmpeg wrapper for video processing
    court_detect.py                  — Court line detection (OpenCV)
    frame_extract.py                 — Key frame extraction
    scoreboard_ocr.py                — Scoreboard text extraction
  scripts/
    process_clip.py                  — CLI: process single clip
    process_game.py                  — CLI: process full game
    demo.py                          — Demo script with sample output
  tests/
    test_segment.py
    test_classify.py
    test_align.py

# Next.js Film Browser
src/app/film/page.tsx                — Film library browser
src/app/film/upload/page.tsx         — Upload clip page
src/app/film/[id]/page.tsx           — Single clip viewer + analysis
src/components/film/ClipCard.tsx     — Clip thumbnail card
src/components/film/ClipPlayer.tsx   — Video player with annotations
src/components/film/ClipTimeline.tsx — Scrubber with event markers
src/components/film/TagBadge.tsx     — Event/action tag display
src/components/film/FilmSearch.tsx   — Search clips by player/action/game
src/components/film/UploadZone.tsx   — Drag-drop upload area
src/app/api/film/clips/route.ts     — List/search clips
src/app/api/film/clips/[id]/route.ts — Get clip details + analysis
src/app/api/film/upload/route.ts    — Handle clip upload
src/app/api/film/process/route.ts   — Trigger processing pipeline
src/app/api/film/tags/route.ts      — List all tags
src/lib/film-db.ts                  — Film database queries
```

### Files this instance MUST NOT touch:
```
src/app/shot-lab/*                  — Existing
src/app/zones/*                     — Instance 2 owns
src/app/matchup/*                   — Instance 3 owns
src/lib/db.ts                       — Instance 1 may modify
src/components/layout/AppShell.tsx   — Instance 1 may modify
src/components/court/*              — Instance 2 may extend
```

---

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   Film Browser   │
                                    │   (Next.js UI)   │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Film API       │
                                    │   (Next.js)      │
                                    └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                     ┌────────▼──┐    ┌──────▼──┐    ┌─────▼────┐
                     │  SQLite   │    │  Clip    │    │  Python  │
                     │  film.db  │    │  Storage │    │  Pipeline│
                     │           │    │  /data/  │    │  video-ml│
                     └───────────┘    │  clips/  │    └──────────┘
                                      └──────────┘
```

### Two databases:
1. **basketball.db** — Existing stats database (read-only from this instance)
2. **film.db** — New film intelligence database (this instance creates + owns)

Separation prevents any conflict with existing data. Film features query both DBs.

### Processing modes:
1. **Quick Analysis** — Upload a clip → basic metadata + tagging (seconds)
2. **Deep Analysis** — Full pipeline: segmentation + detection + classification (minutes)
3. **Game Alignment** — Match processed clips to game log entries (when metadata available)

---

## Phase 1: Database Schema + Python Foundation (Target: 75 min)

### 1a. Film Database Schema (`data/film.db`)

```sql
-- Video files / sources
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
  -- Game context (nullable — not always known)
  game_id TEXT,
  game_date TEXT,
  home_team TEXT,
  away_team TEXT,
  season TEXT,
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Individual clips (segments of a video)
CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  title TEXT,
  start_time REAL NOT NULL,    -- seconds from video start
  end_time REAL NOT NULL,
  duration REAL GENERATED ALWAYS AS (end_time - start_time) STORED,
  thumbnail_path TEXT,         -- path to extracted thumbnail
  -- Game context
  quarter INTEGER,
  game_clock TEXT,             -- "4:32" format
  shot_clock REAL,
  score_home INTEGER,
  score_away INTEGER,
  -- Classification
  possession_type TEXT,        -- 'offense' | 'defense' | 'transition' | 'dead_ball'
  play_type TEXT,              -- 'pnr' | 'iso' | 'post_up' | 'catch_shoot' | etc.
  primary_action TEXT,         -- 'shot' | 'drive' | 'pass' | 'turnover' | 'foul' | etc.
  shot_result TEXT,            -- 'make' | 'miss' | 'blocked' | null (if not a shot)
  -- Player attribution
  primary_player TEXT,
  secondary_player TEXT,       -- passer, screener, etc.
  defender TEXT,
  -- Linkage to stats DB
  player_game_log_id TEXT,     -- FK to basketball.db player_game_logs if aligned
  shot_id TEXT,                -- FK to basketball.db shots table if aligned
  -- Quality/confidence
  confidence REAL DEFAULT 0.0, -- 0-1, how confident we are in the classification
  manually_verified INTEGER DEFAULT 0,
  -- Metadata
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tags (many-to-many with clips)
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

-- Annotations (timestamped notes on clips)
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL REFERENCES clips(id),
  timestamp REAL NOT NULL,     -- seconds into clip
  annotation_type TEXT CHECK(annotation_type IN ('note', 'player_id', 'action', 'highlight')),
  content TEXT NOT NULL,
  x REAL,                      -- normalized 0-1 position in frame
  y REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Processing jobs (track pipeline progress)
CREATE TABLE IF NOT EXISTS processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  job_type TEXT CHECK(job_type IN ('quick', 'deep', 'align')),
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
  progress REAL DEFAULT 0.0,   -- 0-100
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  result_summary TEXT,         -- JSON summary of findings
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id);
CREATE INDEX IF NOT EXISTS idx_clips_player ON clips(primary_player);
CREATE INDEX IF NOT EXISTS idx_clips_play_type ON clips(play_type);
CREATE INDEX IF NOT EXISTS idx_clips_action ON clips(primary_action);
CREATE INDEX IF NOT EXISTS idx_clip_tags_clip ON clip_tags(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_tags_tag ON clip_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_annotations_clip ON annotations(clip_id);
```

### 1b. Python Pipeline Foundation

**`video-ml/requirements.txt`:**
```
opencv-python-headless>=4.9.0
numpy>=1.26.0
Pillow>=10.0.0
pydantic>=2.5.0
ffmpeg-python>=0.2.0
pytesseract>=0.3.10
scikit-learn>=1.4.0
torch>=2.2.0
torchvision>=0.17.0
ultralytics>=8.1.0          # YOLOv8 for object detection
sentence-transformers>=2.3.0 # For clip embeddings
tqdm>=4.66.0
click>=8.1.0                 # CLI
```

**`video-ml/config.py`:**
```python
from pathlib import Path
from pydantic import BaseModel

class PipelineConfig(BaseModel):
    # Paths
    data_dir: Path = Path("data/clips")
    film_db_path: Path = Path("data/film.db")
    basketball_db_path: Path = Path("data/basketball.db")
    temp_dir: Path = Path("data/temp")

    # Processing
    target_fps: int = 5           # Downsample to 5fps for analysis
    clip_min_duration: float = 2.0  # Minimum clip length in seconds
    clip_max_duration: float = 30.0
    thumbnail_width: int = 320
    thumbnail_height: int = 180

    # Detection
    yolo_model: str = "yolov8n.pt"  # Nano model for speed
    confidence_threshold: float = 0.5
    court_detection_enabled: bool = True

    # Classification
    play_types: list[str] = [
        "pnr_ball_handler", "pnr_roll_man", "isolation",
        "post_up", "catch_and_shoot", "spot_up",
        "transition", "handoff", "off_screen",
        "cut", "putback", "fastbreak"
    ]

    actions: list[str] = [
        "shot_attempt", "made_shot", "missed_shot", "blocked_shot",
        "drive", "pass", "assist", "turnover", "steal",
        "foul", "free_throw", "rebound", "block",
        "dunk", "layup", "floater", "midrange", "three_pointer"
    ]
```

**`video-ml/pipeline/schemas.py`:**
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VideoMetadata(BaseModel):
    title: str
    duration: float
    width: int
    height: int
    fps: float
    file_size: int
    source_type: str = "upload"

class ClipSegment(BaseModel):
    start_time: float
    end_time: float
    confidence: float = 0.0
    quarter: Optional[int] = None
    game_clock: Optional[str] = None

class DetectionResult(BaseModel):
    frame_number: int
    timestamp: float
    objects: list[dict]  # {class, confidence, bbox}
    court_detected: bool = False

class ClassificationResult(BaseModel):
    clip_id: int
    play_type: Optional[str] = None
    primary_action: Optional[str] = None
    primary_player: Optional[str] = None
    confidence: float = 0.0
    tags: list[str] = []

class ProcessingResult(BaseModel):
    video_id: int
    clips_found: int
    clips_classified: int
    tags_generated: int
    processing_time: float
    errors: list[str] = []
```

### 1c. Core Pipeline Modules

**`video-ml/pipeline/ingest.py`:**
```python
"""Video ingestion: extract metadata, create DB record, prepare for processing."""
import sqlite3
import json
from pathlib import Path
from ..config import PipelineConfig
from ..models.schemas import VideoMetadata
from ..utils.ffmpeg import get_video_metadata, extract_thumbnail

def ingest_video(filepath: Path, config: PipelineConfig, game_context: dict | None = None) -> int:
    """Ingest a video file: extract metadata, create DB record, return video_id."""
    metadata = get_video_metadata(filepath)
    thumbnail = extract_thumbnail(filepath, config.data_dir / "thumbnails")

    db = sqlite3.connect(str(config.film_db_path))
    cursor = db.execute("""
        INSERT INTO videos (title, filename, filepath, duration_seconds, width, height,
                          fps, file_size_bytes, source_type, game_id, game_date,
                          home_team, away_team, season, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (
        metadata.title, filepath.name, str(filepath), metadata.duration,
        metadata.width, metadata.height, metadata.fps, metadata.file_size,
        metadata.source_type,
        game_context.get('game_id') if game_context else None,
        game_context.get('game_date') if game_context else None,
        game_context.get('home_team') if game_context else None,
        game_context.get('away_team') if game_context else None,
        game_context.get('season') if game_context else None,
    ))
    video_id = cursor.lastrowid
    db.commit()
    db.close()
    return video_id
```

**`video-ml/pipeline/segment.py`:**
```python
"""Scene/possession segmentation: detect cuts, shot attempts, dead balls."""
import cv2
import numpy as np
from pathlib import Path
from ..config import PipelineConfig
from ..models.schemas import ClipSegment

def detect_scene_changes(video_path: Path, config: PipelineConfig) -> list[ClipSegment]:
    """Detect scene boundaries using frame differencing + audio cues."""
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    segments: list[ClipSegment] = []

    prev_frame = None
    scene_start = 0.0
    threshold = 30.0  # Pixel difference threshold for scene change

    frame_idx = 0
    sample_rate = max(1, int(fps / config.target_fps))  # Downsample

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_rate == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (320, 180))

            if prev_frame is not None:
                diff = np.mean(np.abs(gray.astype(float) - prev_frame.astype(float)))
                if diff > threshold:
                    end_time = frame_idx / fps
                    duration = end_time - scene_start
                    if config.clip_min_duration <= duration <= config.clip_max_duration:
                        segments.append(ClipSegment(
                            start_time=scene_start,
                            end_time=end_time,
                            confidence=min(diff / 100, 1.0)
                        ))
                    scene_start = end_time

            prev_frame = gray
        frame_idx += 1

    cap.release()
    return segments


def detect_possessions(video_path: Path, segments: list[ClipSegment], config: PipelineConfig) -> list[ClipSegment]:
    """Refine segments into basketball possessions using heuristics."""
    # Merge very short segments
    # Split very long segments at likely possession boundaries
    # Use scoreboard changes as markers (if OCR available)
    refined: list[ClipSegment] = []
    for seg in segments:
        if seg.end_time - seg.start_time < config.clip_min_duration:
            continue
        if seg.end_time - seg.start_time > config.clip_max_duration:
            # Split into chunks
            t = seg.start_time
            while t < seg.end_time:
                end = min(t + 15.0, seg.end_time)
                if end - t >= config.clip_min_duration:
                    refined.append(ClipSegment(start_time=t, end_time=end))
                t = end
        else:
            refined.append(seg)
    return refined
```

**`video-ml/pipeline/classify.py`:**
```python
"""Action classification: determine play type and primary action from clip."""
from pathlib import Path
from ..config import PipelineConfig
from ..models.schemas import ClassificationResult

def classify_clip(video_path: Path, start: float, end: float, config: PipelineConfig) -> ClassificationResult:
    """Classify a single clip using frame analysis + heuristics."""
    # Phase 1: Rule-based classification from visual features
    # - Ball near basket + upward motion → shot attempt
    # - Fast horizontal movement → transition/drive
    # - Players stationary → dead ball / free throw
    # - Court edge + ball → inbound play

    # For tonight's MVP, use a simplified classifier:
    # 1. Extract key frames (start, middle, end of clip)
    # 2. Detect court regions where action happens
    # 3. Estimate action type from movement patterns

    return ClassificationResult(
        clip_id=0,  # Set by caller
        play_type="unknown",
        primary_action="unknown",
        confidence=0.0,
        tags=[]
    )


def classify_with_context(clip_result: ClassificationResult,
                         game_context: dict | None = None) -> ClassificationResult:
    """Enhance classification using play-by-play alignment."""
    # If we have PBP data for this game + timestamp, we can:
    # - Match the clip to a specific play
    # - Know the exact player, action, result
    # - Add tags from PBP description
    if game_context is None:
        return clip_result

    # Match timestamp to PBP entry
    # Enhance tags with player names, shot type, etc.
    return clip_result
```

**`video-ml/utils/ffmpeg.py`:**
```python
"""FFmpeg utilities for video processing."""
import subprocess
import json
from pathlib import Path
from ..models.schemas import VideoMetadata

def get_video_metadata(filepath: Path) -> VideoMetadata:
    """Extract video metadata using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams', str(filepath)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)

    video_stream = next(s for s in data['streams'] if s['codec_type'] == 'video')
    return VideoMetadata(
        title=filepath.stem,
        duration=float(data['format']['duration']),
        width=int(video_stream['width']),
        height=int(video_stream['height']),
        fps=eval(video_stream['r_frame_rate']),  # "30/1" → 30.0
        file_size=int(data['format']['size']),
    )

def extract_thumbnail(filepath: Path, output_dir: Path, timestamp: float = 2.0) -> Path:
    """Extract a thumbnail frame from a video."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"{filepath.stem}_thumb.jpg"
    cmd = [
        'ffmpeg', '-y', '-ss', str(timestamp), '-i', str(filepath),
        '-vframes', '1', '-s', '320x180', '-q:v', '3', str(output)
    ]
    subprocess.run(cmd, capture_output=True)
    return output

def extract_clip(filepath: Path, start: float, end: float, output: Path) -> Path:
    """Extract a clip segment from a video."""
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        'ffmpeg', '-y', '-ss', str(start), '-to', str(end),
        '-i', str(filepath), '-c', 'copy', str(output)
    ]
    subprocess.run(cmd, capture_output=True)
    return output

def extract_frames(filepath: Path, output_dir: Path, fps: int = 5) -> list[Path]:
    """Extract frames at given fps."""
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = output_dir / "frame_%06d.jpg"
    cmd = [
        'ffmpeg', '-y', '-i', str(filepath),
        '-vf', f'fps={fps}', '-q:v', '3', str(pattern)
    ]
    subprocess.run(cmd, capture_output=True)
    return sorted(output_dir.glob("frame_*.jpg"))
```

**`video-ml/utils/court_detect.py`:**
```python
"""Basketball court detection using OpenCV."""
import cv2
import numpy as np

def detect_court(frame: np.ndarray) -> dict:
    """Detect basketball court lines in a frame."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Court floor is typically warm brown/orange or hardwood color
    # Lines are white
    # Detect white lines using threshold
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)

    # Detect lines using HoughLines
    lines = cv2.HoughLinesP(binary, 1, np.pi/180, threshold=80,
                            minLineLength=50, maxLineGap=10)

    court_detected = lines is not None and len(lines) > 5

    return {
        'court_detected': court_detected,
        'line_count': len(lines) if lines is not None else 0,
        'lines': lines.tolist() if lines is not None else [],
    }


def detect_three_point_arc(frame: np.ndarray) -> dict:
    """Detect the three-point arc to establish court geometry."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    circles = cv2.HoughCircles(edges, cv2.HOUGH_GRADIENT, dp=1.2,
                                minDist=100, param1=50, param2=30,
                                minRadius=80, maxRadius=300)
    if circles is not None:
        circles = np.uint16(np.around(circles))
        return {
            'arc_detected': True,
            'center': (int(circles[0][0][0]), int(circles[0][0][1])),
            'radius': int(circles[0][0][2])
        }
    return {'arc_detected': False}
```

### Phase 1 Gate
- [ ] `film.db` schema creates successfully
- [ ] Python package structure is correct (all __init__.py files)
- [ ] `get_video_metadata()` works on a test video (or gracefully handles missing ffmpeg)
- [ ] `detect_scene_changes()` produces reasonable segments
- [ ] All Pydantic models validate correctly
- [ ] `pip install -r requirements.txt` succeeds (or document what needs installing)

---

## Phase 2: Next.js Film Database Layer (Target: 45 min)

### 2a. Create `src/lib/film-db.ts`

```typescript
import Database from 'better-sqlite3';
import path from 'path';

let filmDb: Database.Database | null = null;

export function getFilmDb(): Database.Database {
  if (!filmDb) {
    const dbPath = path.join(process.cwd(), 'data', 'film.db');
    filmDb = new Database(dbPath);
    filmDb.pragma('journal_mode = WAL');
    filmDb.pragma('cache_size = -16384'); // 16MB cache

    // Create tables if they don't exist (self-initializing)
    filmDb.exec(SCHEMA_SQL);
  }
  return filmDb;
}

const SCHEMA_SQL = `
  -- [Paste full schema from Phase 1a here]
`;

// ── Query functions ──

export interface ClipRow {
  readonly id: number;
  readonly videoId: number;
  readonly title: string | null;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly thumbnailPath: string | null;
  readonly quarter: number | null;
  readonly gameClock: string | null;
  readonly playType: string | null;
  readonly primaryAction: string | null;
  readonly primaryPlayer: string | null;
  readonly defender: string | null;
  readonly confidence: number;
  readonly tags: string[];
}

export function listClips(filters: {
  player?: string;
  playType?: string;
  action?: string;
  tag?: string;
  gameDate?: string;
  limit?: number;
  offset?: number;
}): { clips: ClipRow[]; total: number } { ... }

export function getClip(id: number): ClipRow | null { ... }

export function searchClips(query: string, limit?: number): ClipRow[] { ... }

export function getClipTags(clipId: number): Array<{ name: string; category: string }> { ... }

export function getClipAnnotations(clipId: number): Array<{
  timestamp: number;
  type: string;
  content: string;
  x: number | null;
  y: number | null;
}> { ... }

export function getVideoSummary(videoId: number): {
  video: { id: number; title: string; duration: number; status: string };
  clipCount: number;
  tagCounts: Record<string, number>;
  playerMentions: Array<{ player: string; clipCount: number }>;
} { ... }

export function getAllTags(): Array<{ name: string; category: string; count: number }> { ... }

// Insert functions (for the processing pipeline)
export function insertVideo(data: Omit<VideoRow, 'id'>): number { ... }
export function insertClip(data: Omit<ClipRow, 'id' | 'tags'>): number { ... }
export function addClipTag(clipId: number, tagName: string, category: string, confidence?: number): void { ... }
```

### Phase 2 Gate
- [ ] `getFilmDb()` creates film.db with correct schema
- [ ] All query functions compile
- [ ] Insert + query round-trip works
- [ ] Build passes

---

## Phase 3: Film API Routes (Target: 45 min)

### 3a. `src/app/api/film/clips/route.ts`

```
GET /api/film/clips?player=LeBron&playType=iso&tag=clutch&limit=20&offset=0
Response: {
  clips: ClipRow[],
  total: number,
  filters: { player?, playType?, action?, tag? }
}

POST /api/film/clips  (manual clip entry — for demo/testing)
Body: { videoId, startTime, endTime, playType?, primaryPlayer?, tags?: string[] }
Response: { id: number }
```

### 3b. `src/app/api/film/clips/[id]/route.ts`

```
GET /api/film/clips/{id}
Response: {
  clip: ClipRow,
  video: VideoRow,
  tags: Array<{ name, category }>,
  annotations: Array<{ timestamp, type, content }>,
  relatedClips: ClipRow[]  // Same player or similar tags
}
```

### 3c. `src/app/api/film/upload/route.ts`

```
POST /api/film/upload
Body: FormData with 'file' field
Response: { videoId: number, status: 'pending' }

Saves file to data/clips/ directory.
Creates video record in film.db.
Returns immediately — processing happens async.
```

### 3d. `src/app/api/film/process/route.ts`

```
POST /api/film/process
Body: { videoId: number, mode: 'quick' | 'deep' }
Response: { jobId: number, status: 'queued' }

GET /api/film/process?jobId={id}
Response: { status, progress, result? }
```

For the MVP: processing is simulated. Create realistic-looking results with placeholder data. The Python pipeline can be connected later.

### 3e. `src/app/api/film/tags/route.ts`

```
GET /api/film/tags
Response: {
  tags: Array<{ name, category, count }>,
  categories: string[]
}
```

### Phase 3 Gate
- [ ] All API routes return valid JSON
- [ ] Upload endpoint saves files correctly
- [ ] Clip CRUD works
- [ ] Tag filtering works
- [ ] Build passes

---

## Phase 4: Film Browser UI (Target: 90 min)

### 4a. Film Library Page (`src/app/film/page.tsx`)

**Design: Netflix-meets-film-room aesthetic. Dark, cinematic, content-dense.**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   🎬 FILM ROOM                                              │
│   Basketball Intelligence from Video                         │
│                                                              │
│   [Search clips by player, action, or game...        🔍]    │
│                                                              │
│   [Upload Clip ↑]   Filter: [All ▾] [Player ▾] [Action ▾]  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Recent Clips                                               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│   │ [Thumb]  │ │ [Thumb]  │ │ [Thumb]  │ │ [Thumb]  │      │
│   │ ▶ 0:12  │ │ ▶ 0:08  │ │ ▶ 0:15  │ │ ▶ 0:11  │      │
│   │          │ │          │ │          │ │          │      │
│   │ PnR      │ │ ISO      │ │ Trans   │ │ Post    │      │
│   │ LeBron   │ │ Curry    │ │ Luka    │ │ Jokic   │      │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                              │
│   By Play Type                                               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│   │ Pick &   │ │Isolation │ │Catch &   │ ... (horizontal)   │
│   │ Roll (42)│ │ (28)     │ │Shoot (35)│                    │
│   └──────────┘ └──────────┘ └──────────┘                    │
│                                                              │
│   By Player                                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│   │ LeBron   │ │ Curry    │ │ Jokic    │ ... (horizontal)   │
│   │ 15 clips │ │ 12 clips │ │ 8 clips  │                    │
│   └──────────┘ └──────────┘ └──────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4b. ClipCard.tsx

```typescript
interface ClipCardProps {
  readonly clip: ClipRow;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly showPlayer?: boolean;
  readonly showTags?: boolean;
  readonly onClick?: () => void;
}
```

**Card design (md size, ~200x160):**
```
┌────────────────────────┐
│  [Thumbnail Image]     │
│  ▶ 0:12               │  ← Play button overlay, duration badge
│                        │
│  LeBron • PnR • Q3    │  ← Player, play type, quarter
│  [ISO] [CLUTCH]        │  ← Tag badges
└────────────────────────┘
```

- Thumbnail: 16:9 with dark overlay gradient at bottom
- Play icon: centered, semi-transparent, scales on hover
- Duration badge: bottom-right, rounded pill
- Tags: colored badges matching existing Badge component
- Hover: card lifts (y: -4), thumbnail zooms slightly (scale: 1.05)
- Glass card background

### 4c. Clip Viewer Page (`src/app/film/[id]/page.tsx`)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Film Room                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │              [VIDEO PLAYER]                          │    │
│  │              16:9 aspect ratio                       │    │
│  │                                                      │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │ [Timeline with event markers]                   │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │  Clip Details        │  │  Analysis                    │   │
│  │                      │  │                              │   │
│  │  Play Type: PnR     │  │  Primary: LeBron James       │   │
│  │  Action: Drive      │  │  Defender: Curry             │   │
│  │  Result: Made Layup │  │  Quarter: 3                  │   │
│  │  Quarter: Q3 4:32   │  │  Score: LAL 87 - GSW 82     │   │
│  │                      │  │  Game: Mar 15, 2024         │   │
│  │  Tags:              │  │                              │   │
│  │  [PNR] [DRIVE]      │  │  Confidence: 78%            │   │
│  │  [CLUTCH] [MADE]    │  │  [Verify ✓] [Edit ✏️]       │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
│                                                              │
│  Related Clips                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
│  │      │ │      │ │      │ │      │                       │
│  └──────┘ └──────┘ └──────┘ └──────┘                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4d. ClipPlayer.tsx

HTML5 video player with custom controls matching the glass morphism design.

```typescript
interface ClipPlayerProps {
  readonly src: string;
  readonly poster?: string;
  readonly annotations?: Array<{ timestamp: number; content: string }>;
  readonly onTimeUpdate?: (time: number) => void;
}
```

- Custom play/pause button (big center play, small controls at bottom)
- Glass control bar with backdrop blur
- Timeline scrubber with annotation markers (colored dots)
- Speed control (0.5x, 1x, 1.5x, 2x)
- Fullscreen toggle

### 4e. Upload Page (`src/app/film/upload/page.tsx`)

```
┌──────────────────────────────────────────┐
│                                          │
│   Upload Film                            │
│                                          │
│   ┌────────────────────────────────┐     │
│   │                                │     │
│   │   Drop video file here         │     │
│   │   or click to browse           │     │
│   │                                │     │
│   │   MP4, MOV, AVI — up to 500MB │     │
│   │                                │     │
│   └────────────────────────────────┘     │
│                                          │
│   Game Context (optional):               │
│   [Game Date]  [Home Team]  [Away Team]  │
│   [Season]     [Player Focus]            │
│                                          │
│   [Upload & Analyze →]                   │
│                                          │
└──────────────────────────────────────────┘
```

UploadZone.tsx:
- Drag-and-drop with visual feedback (border color change, icon animation)
- Progress bar during upload
- File type validation (video/* only)
- Size limit warning

### Phase 4 Gate
- [ ] Film library page renders with placeholder data
- [ ] Clip cards render with correct layout
- [ ] Upload page handles file selection
- [ ] Clip viewer page shows video (if file exists) or placeholder
- [ ] All navigation works
- [ ] Mobile responsive
- [ ] Build passes

---

## Phase 5: Demo Data + Pipeline Integration (Target: 45 min)

### 5a. Create demo/seed data

Create `src/scripts/seed-film-data.ts` that:
1. Inserts 5 sample video records (representing games)
2. Inserts 50 sample clips with realistic metadata
3. Adds tags across all categories
4. Adds sample annotations

This makes the Film Browser feel alive even without real video processing.

Sample data should reference real players and games from the basketball.db.

### 5b. Python CLI scripts

**`video-ml/scripts/process_clip.py`:**
```bash
python -m video_ml.scripts.process_clip --input path/to/clip.mp4 --output data/clips/
```

**`video-ml/scripts/demo.py`:**
```bash
python -m video_ml.scripts.demo
```
Generates sample processing output to verify the pipeline structure works end-to-end.

### 5c. Connect pipeline to frontend

When `/api/film/process` is called:
1. Save the request to processing_jobs table
2. For MVP: generate realistic mock results after a short delay
3. Later: actually spawn the Python pipeline

### 5d. Add "Film" to navigation

Create a note in the plan about adding Film to AppShell navigation — but DON'T modify AppShell (Instance 1 owns it). Instead, document the nav entry needed:
```typescript
{ id: 'film', label: 'Film', icon: Film, href: '/film' }
```

### Phase 5 Gate
- [ ] Demo data populates Film Browser with realistic clips
- [ ] Python pipeline modules import without errors
- [ ] CLI demo script runs (even if it generates mock output)
- [ ] Full build passes: `npm run build`
- [ ] Film pages work end-to-end with demo data

---

## Subagent Orchestration

### Agent 1: CODE WRITER
Focus areas:
- Python pipeline structure (proper packages, imports, typing)
- FFmpeg wrapper (must handle missing ffmpeg gracefully)
- OpenCV integration (headless mode for server)
- Next.js file upload handling (FormData, stream to disk)
- Video player component (HTML5 video API)

Watch-outs:
- Python and Node.js code in same repo — keep separate dirs
- better-sqlite3 for film.db is the same as basketball.db — share the pattern
- File paths: Windows uses backslashes, normalize with path.join/Path
- Video upload: handle large files, set appropriate limits
- Don't import cv2 or torch in Node.js code!

### Agent 2: DEBUG / TEST
Instructions:
- Run `npm run build` for Next.js after each phase
- For Python: run `python -c "from video_ml.pipeline import ingest"` to verify imports
- Test SQLite schema creation: `sqlite3 data/film.db ".tables"`
- Check API routes with curl
- Verify file upload creates files in correct directory
- Test edge cases: missing ffmpeg, corrupt video file, empty clip list

### Agent 3: CODE QUALITY REVIEW
Instructions:
- Python code must follow PEP 8, use type hints, Pydantic models
- TypeScript code must match existing codebase patterns
- Verify no secrets or hardcoded paths
- Check that film.db queries are parameterized
- Verify error handling on file operations (disk full, permission denied)
- Check that video player handles missing src gracefully
- Review SQL schema for proper constraints and indexes

---

## Data Integration

### This instance creates its OWN data
Film data is independent of the basketball stats scraping. The instance:
1. Creates film.db from scratch
2. Seeds it with demo data
3. Links to basketball.db (read-only) for player/game context

### Connection to basketball.db
When a clip references a player name, look them up in basketball.db:
```typescript
import { getDb } from './db'; // basketball.db
const player = getDb().prepare('SELECT * FROM players WHERE Player = ?').get(playerName);
```

This provides rich context (team, position, stats) for film entries.

---

## Success Criteria

After 6 hours:
1. Complete Python pipeline skeleton with all modules
2. Film SQLite database with proper schema
3. Film Browser UI with clip grid, search, filters
4. Clip viewer page with player and analysis panel
5. Upload page with drag-drop zone
6. Demo data making the Film Room feel alive
7. Working API routes for clip CRUD
8. Python scripts that run (even with mock output)
9. Beautiful, cinematic dark UI matching the platform aesthetic
10. Zero build errors in both Next.js and Python
11. Clear documentation of how to extend each pipeline stage
