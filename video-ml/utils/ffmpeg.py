"""FFmpeg wrapper with graceful fallback when ffmpeg is not installed.

Every function wraps subprocess calls in try/except and returns mock or
fallback data when ffmpeg/ffprobe is unavailable.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def _ffmpeg_available() -> bool:
    """Check if ffmpeg is on PATH."""
    return shutil.which("ffmpeg") is not None


def _ffprobe_available() -> bool:
    """Check if ffprobe is on PATH."""
    return shutil.which("ffprobe") is not None


def get_video_metadata(video_path: str) -> dict:
    """Extract video metadata using ffprobe.

    Returns a dict with keys: duration, width, height, fps, codec, bitrate.
    Falls back to OpenCV, then to mock data if ffprobe is unavailable.
    """
    # Attempt 1: ffprobe
    if _ffprobe_available():
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    "-show_streams",
                    video_path,
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                video_stream = next(
                    (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
                    {},
                )
                fmt = data.get("format", {})

                fps = 0.0
                r_frame_rate = video_stream.get("r_frame_rate", "0/1")
                if "/" in r_frame_rate:
                    num, den = r_frame_rate.split("/")
                    if int(den) > 0:
                        fps = int(num) / int(den)

                return {
                    "duration": float(fmt.get("duration", 0)),
                    "width": int(video_stream.get("width", 0)),
                    "height": int(video_stream.get("height", 0)),
                    "fps": round(fps, 2),
                    "codec": video_stream.get("codec_name", "unknown"),
                    "bitrate": int(fmt.get("bit_rate", 0)),
                }
        except (subprocess.TimeoutExpired, json.JSONDecodeError, StopIteration) as exc:
            logger.warning("ffprobe failed for %s: %s", video_path, exc)
        except FileNotFoundError:
            logger.warning("ffprobe not found on PATH")
    else:
        logger.info("ffprobe not available")

    # Attempt 2: OpenCV fallback
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            meta = {
                "duration": cap.get(cv2.CAP_PROP_FRAME_COUNT) / max(cap.get(cv2.CAP_PROP_FPS), 1),
                "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "fps": round(cap.get(cv2.CAP_PROP_FPS), 2),
                "codec": "unknown",
                "bitrate": 0,
            }
            cap.release()
            logger.info("Used OpenCV fallback for metadata of %s", video_path)
            return meta
        cap.release()
    except ImportError:
        logger.info("OpenCV not available for metadata fallback")
    except Exception as exc:
        logger.warning("OpenCV metadata extraction failed: %s", exc)

    # Attempt 3: Mock data
    logger.warning(
        "Returning mock metadata for %s (ffprobe and OpenCV unavailable)", video_path
    )
    file_path = Path(video_path)
    file_size = file_path.stat().st_size if file_path.exists() else 0
    # Rough heuristic: assume 2 Mbps bitrate for duration estimate
    estimated_duration = (file_size * 8) / 2_000_000 if file_size > 0 else 120.0

    return {
        "duration": round(estimated_duration, 1),
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "codec": "mock",
        "bitrate": 0,
    }


def extract_thumbnail(
    video_path: str,
    output_path: str,
    *,
    timestamp: float = 1.0,
    width: int = 320,
    height: int = 180,
) -> str | None:
    """Extract a thumbnail frame from a video.

    Returns the output path on success, None on failure.
    """
    # Attempt 1: ffmpeg
    if _ffmpeg_available():
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss", str(timestamp),
                    "-i", video_path,
                    "-vframes", "1",
                    "-vf", f"scale={width}:{height}",
                    output_path,
                ],
                capture_output=True,
                timeout=15,
                check=True,
            )
            logger.info("Extracted thumbnail at %.1fs to %s", timestamp, output_path)
            return output_path
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            logger.warning("ffmpeg thumbnail extraction failed: %s", exc)
        except FileNotFoundError:
            pass

    # Attempt 2: OpenCV fallback
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(timestamp * fps))
            ret, frame = cap.read()
            cap.release()
            if ret:
                resized = cv2.resize(frame, (width, height))
                cv2.imwrite(output_path, resized)
                logger.info("Extracted thumbnail via OpenCV to %s", output_path)
                return output_path
    except ImportError:
        pass
    except Exception as exc:
        logger.warning("OpenCV thumbnail extraction failed: %s", exc)

    # Attempt 3: Pillow placeholder
    try:
        from PIL import Image

        img = Image.new("RGB", (width, height), color=(30, 30, 30))
        img.save(output_path)
        logger.info("Created placeholder thumbnail at %s", output_path)
        return output_path
    except ImportError:
        pass
    except Exception as exc:
        logger.warning("Pillow placeholder creation failed: %s", exc)

    logger.error("All thumbnail extraction methods failed for %s", video_path)
    return None


def extract_clip(
    video_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
) -> str | None:
    """Extract a clip segment from a video file.

    Returns the output path on success, None on failure.
    """
    if not _ffmpeg_available():
        logger.warning("ffmpeg not available -- cannot extract clip from %s", video_path)
        return None

    duration = end_time - start_time
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss", str(start_time),
                "-i", video_path,
                "-t", str(duration),
                "-c", "copy",
                output_path,
            ],
            capture_output=True,
            timeout=120,
            check=True,
        )
        logger.info("Extracted clip %.1f-%.1fs to %s", start_time, end_time, output_path)
        return output_path
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
        logger.error("Clip extraction failed: %s", exc)
        return None


def extract_frames(
    video_path: str,
    output_dir: str,
    *,
    fps: float = 2.0,
    start_time: float = 0.0,
    end_time: float | None = None,
) -> list[str]:
    """Extract frames from a video at a given FPS.

    Returns a list of output frame file paths.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Attempt 1: ffmpeg
    if _ffmpeg_available():
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-ss", str(start_time),
                "-i", video_path,
            ]
            if end_time is not None:
                cmd.extend(["-t", str(end_time - start_time)])
            cmd.extend([
                "-vf", f"fps={fps}",
                str(output_path / "frame_%06d.jpg"),
            ])

            subprocess.run(cmd, capture_output=True, timeout=300, check=True)
            frames = sorted(output_path.glob("frame_*.jpg"))
            logger.info("Extracted %d frames via ffmpeg to %s", len(frames), output_dir)
            return [str(f) for f in frames]
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
            logger.warning("ffmpeg frame extraction failed: %s", exc)

    # Attempt 2: OpenCV fallback
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error("Could not open video with OpenCV: %s", video_path)
            return []

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        sample_interval = max(1, int(video_fps / fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(start_time * video_fps))

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        end_frame = int(end_time * video_fps) if end_time else total_frames

        frame_paths: list[str] = []
        frame_idx = int(start_time * video_fps)
        count = 0

        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_interval == 0:
                path = str(output_path / f"frame_{count:06d}.jpg")
                cv2.imwrite(path, frame)
                frame_paths.append(path)
                count += 1
            frame_idx += 1

        cap.release()
        logger.info("Extracted %d frames via OpenCV to %s", len(frame_paths), output_dir)
        return frame_paths
    except ImportError:
        logger.warning("OpenCV not available for frame extraction")
    except Exception as exc:
        logger.warning("OpenCV frame extraction failed: %s", exc)

    logger.error("All frame extraction methods failed for %s", video_path)
    return []
