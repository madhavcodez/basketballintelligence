# Basketball Film Copilot - Video ML Pipeline

Python package for basketball video analysis: ingestion, segmentation, detection, classification, alignment, tagging, embedding, and export.

## Architecture

```
video-ml/
├── config.py              # PipelineConfig (Pydantic BaseModel)
├── models/
│   └── schemas.py         # Data models: VideoMetadata, ClipSegment, DetectionResult, etc.
├── pipeline/
│   ├── ingest.py          # Video ingestion + metadata extraction
│   ├── segment.py         # Scene/possession detection (OpenCV frame differencing)
│   ├── detect.py          # Object detection (mock for MVP, YOLO when available)
│   ├── classify.py        # Action classification (rule-based fallback)
│   ├── align.py           # Play-by-play alignment
│   ├── tag.py             # Auto-tagging engine
│   ├── embed.py           # Clip embedding generation
│   └── export.py          # SQLite/JSON export for frontend
├── utils/
│   ├── ffmpeg.py          # FFmpeg wrapper with graceful fallback
│   ├── court_detect.py    # Court line detection (OpenCV)
│   ├── frame_extract.py   # Key frame extraction
│   └── scoreboard_ocr.py  # Scoreboard OCR (stub)
├── scripts/
│   ├── process_clip.py    # CLI: process single clip
│   ├── process_game.py    # CLI: process full game
│   └── demo.py            # Generate sample data without real video
└── tests/
    ├── test_segment.py
    ├── test_classify.py
    └── test_align.py
```

## Pipeline Flow

```
Video File
  ↓
[ingest] → Extract metadata, create DB record
  ↓
[segment] → Split into clips via frame differencing
  ↓
[detect] → Object detection per frame (players, ball, hoop)
  ↓
[classify] → Play type + action classification
  ↓
[align] → Match clips to play-by-play data
  ↓
[tag] → Generate categorized tags
  ↓
[embed] → Generate vector embeddings for similarity search
  ↓
[export] → Write to film.db + JSON for frontend
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Generate demo data (no real video needed)
python -m scripts.demo

# Process a real video clip
python -m scripts.process_clip --input path/to/clip.mp4

# Process a full game
python -m scripts.process_game --input game.mp4 --home-team "Lakers" --away-team "Celtics"

# Run tests
pytest tests/ -v
```

## Graceful Degradation

The pipeline is designed to work even without heavy dependencies:

| Dependency | Installed | Fallback |
|-----------|-----------|----------|
| ffmpeg/ffprobe | Real metadata extraction | OpenCV fallback, then mock data |
| opencv-python-headless | Frame differencing segmentation | Uniform time-based splitting |
| ultralytics (YOLO) | Real object detection | Mock detection results |
| sentence-transformers | Semantic embeddings | Deterministic pseudo-random vectors |
| Tesseract/EasyOCR | Scoreboard reading | Mock scoreboard data |

## Database Schema

The pipeline writes to `data/film.db` (SQLite) with tables:
- **videos** -- Video files and metadata
- **clips** -- Detected clip segments with classification
- **tags** -- Tag definitions (action, player, team, context, quality, custom)
- **clip_tags** -- Many-to-many clip-tag associations
- **annotations** -- User annotations on clips
- **processing_jobs** -- Job tracking for async processing

## Configuration

All configuration is in `config.py` via `PipelineConfig`:

```python
from config import PipelineConfig

config = PipelineConfig(
    data_dir=Path("data/clips"),
    film_db_path=Path("data/film.db"),
    scene_change_threshold=30.0,
    confidence_threshold=0.5,
    target_fps=2.0,
)
```
