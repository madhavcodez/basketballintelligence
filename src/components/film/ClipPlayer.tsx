'use client';

import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Film,
} from 'lucide-react';
import clsx from 'clsx';
import ClipTimeline from './ClipTimeline';

interface Annotation {
  readonly id: string | number;
  readonly time: number;
  readonly label: string;
  readonly type: 'play' | 'event' | 'highlight' | 'note';
}

interface ClipPlayerProps {
  readonly src?: string | null;
  readonly poster?: string | null;
  readonly annotations?: ReadonlyArray<Annotation>;
  readonly onTimeUpdate?: (currentTime: number, duration: number) => void;
  readonly className?: string;
}

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
const SPEEDS: ReadonlyArray<PlaybackSpeed> = [0.5, 1, 1.5, 2];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ClipPlayer({
  src,
  poster,
  annotations = [],
  onTimeUpdate,
  className,
}: ClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [showControls, setShowControls] = useState(true);
  const [showBigPlay, setShowBigPlay] = useState(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Playback control ─────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const currentIndex = SPEEDS.indexOf(prev);
      const nextIndex = (currentIndex + 1) % SPEEDS.length;
      const nextSpeed = SPEEDS[nextIndex];
      const video = videoRef.current;
      if (video) {
        video.playbackRate = nextSpeed;
      }
      return nextSpeed;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
      video.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      video.muted = false;
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  /* ── Video event handlers ─────────────────────────────────────── */

  const handleTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration);
    },
    [onTimeUpdate],
  );

  const handleLoadedMetadata = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setShowBigPlay(false);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setShowBigPlay(true);
  }, []);

  /* ── Control bar auto-hide ────────────────────────────────────── */

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      setShowControls(false);
    }
  }, [isPlaying]);

  /* ── Fullscreen change listener ───────────────────────────────── */

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /* ── Cleanup timer on unmount ─────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  /* ── No source placeholder ────────────────────────────────────── */

  if (!src) {
    return (
      <div
        className={clsx(
          'relative flex items-center justify-center',
          'aspect-video w-full rounded-[20px] overflow-hidden',
          'bg-[#F5F5F7]',
          'border border-black/[0.06]',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className={clsx(
              'flex items-center justify-center',
              'h-16 w-16 rounded-2xl',
              'bg-white border border-black/[0.06]',
            )}
          >
            <Film size={28} className="text-[#86868B]" />
          </div>
          <p className="text-sm text-[#86868B]">No video file</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative group aspect-video w-full rounded-[20px] overflow-hidden',
        'bg-[#F5F5F7] border border-black/[0.06]',
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="h-full w-full object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={togglePlay}
        playsInline
      />

      {/* Big center play button */}
      <AnimatePresence>
        {showBigPlay && (
          <motion.button
            type="button"
            className={clsx(
              'absolute inset-0 flex items-center justify-center z-10',
              'bg-black/20',
            )}
            onClick={togglePlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-label="Play video"
          >
            <motion.div
              className={clsx(
                'flex items-center justify-center',
                'h-16 w-16 sm:h-20 sm:w-20 rounded-full',
                'bg-white/80 backdrop-blur-md',
                'border border-black/[0.06]',
                'shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <Play size={28} className="text-[#1D1D1F] ml-1" fill="currentColor" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Glass control bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className={clsx(
              'absolute inset-x-0 bottom-0 z-20',
              'flex flex-col gap-2 px-4 pb-3 pt-8',
              'bg-gradient-to-t from-white/90 via-white/60 to-transparent',
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Timeline */}
            <ClipTimeline
              duration={duration}
              currentTime={currentTime}
              annotations={annotations}
              onSeek={handleSeek}
            />

            {/* Controls row */}
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className={clsx(
                  'flex items-center justify-center',
                  'h-8 w-8 rounded-lg',
                  'text-[#1D1D1F]/90 hover:text-[#1D1D1F]',
                  'transition-colors',
                )}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className={clsx(
                    'w-0 group-hover/volume:w-16',
                    'transition-all duration-200 overflow-hidden',
                    'accent-[#FF6B35] h-1 cursor-pointer',
                    'appearance-none bg-black/10 rounded-full',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3',
                    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1D1D1F]',
                  )}
                  aria-label="Volume"
                />
              </div>

              {/* Time display */}
              <span className="text-[11px] font-mono text-[#6E6E73] select-none">
                {formatTime(currentTime)}
                <span className="text-[#86868B] mx-1">/</span>
                {formatTime(duration)}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Speed */}
              <button
                type="button"
                onClick={cycleSpeed}
                className={clsx(
                  'flex items-center justify-center',
                  'h-7 min-w-[44px] rounded-md px-2',
                  'text-[11px] font-semibold',
                  'bg-black/[0.05] backdrop-blur-sm',
                  'border border-black/[0.06]',
                  speed !== 1 ? 'text-[#FF6B35]' : 'text-[#6E6E73]',
                  'hover:bg-black/[0.08] transition-colors',
                )}
                aria-label={`Playback speed: ${speed}x`}
              >
                {speed}x
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center justify-center h-8 w-8 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
