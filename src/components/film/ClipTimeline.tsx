'use client';

import { type MouseEvent, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface Annotation {
  readonly id: string | number;
  readonly time: number;
  readonly label: string;
  readonly type: 'play' | 'event' | 'highlight' | 'note';
}

interface ClipTimelineProps {
  readonly duration: number;
  readonly currentTime: number;
  readonly annotations?: ReadonlyArray<Annotation>;
  readonly onSeek: (time: number) => void;
  readonly className?: string;
}

const annotationColors: Record<Annotation['type'], string> = {
  play: 'bg-[#FF6B35]',
  event: 'bg-[#0071E3]',
  highlight: 'bg-[#F59E0B]',
  note: 'bg-violet-500',
};

const annotationRingColors: Record<Annotation['type'], string> = {
  play: 'ring-[#FF6B35]/40',
  event: 'ring-[#0071E3]/40',
  highlight: 'ring-[#F59E0B]/40',
  note: 'ring-violet-500/40',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ClipTimeline({
  duration,
  currentTime,
  annotations = [],
  onSeek,
  className,
}: ClipTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [isHoveringTrack, setIsHoveringTrack] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getTimeFromMouseEvent = useCallback(
    (e: MouseEvent<HTMLDivElement>): number => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration],
  );

  const handleTrackClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const time = getTimeFromMouseEvent(e);
      onSeek(time);
    },
    [getTimeFromMouseEvent, onSeek],
  );

  const handleTrackMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      setHoverTime(getTimeFromMouseEvent(e));
    },
    [getTimeFromMouseEvent],
  );

  const handleTrackMouseEnter = useCallback(() => {
    setIsHoveringTrack(true);
  }, []);

  const handleTrackMouseLeave = useCallback(() => {
    setIsHoveringTrack(false);
    setHoveredAnnotation(null);
  }, []);

  const handleAnnotationEnter = useCallback((annotation: Annotation) => {
    setHoveredAnnotation(annotation);
  }, []);

  const handleAnnotationLeave = useCallback(() => {
    setHoveredAnnotation(null);
  }, []);

  const handleAnnotationClick = useCallback(
    (annotation: Annotation, e: MouseEvent) => {
      e.stopPropagation();
      onSeek(annotation.time);
    },
    [onSeek],
  );

  return (
    <div className={clsx('relative select-none', className)}>
      {/* Timeline track */}
      <div
        ref={trackRef}
        className={clsx(
          'relative h-2 cursor-pointer rounded-full',
          'bg-black/[0.06]',
          'transition-all duration-150',
          isHoveringTrack && 'h-3',
        )}
        onClick={handleTrackClick}
        onMouseMove={handleTrackMouseMove}
        onMouseEnter={handleTrackMouseEnter}
        onMouseLeave={handleTrackMouseLeave}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
      >
        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-[#0071E3]"
          style={{ width: `${progress}%` }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />

        {/* Playhead */}
        <motion.div
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'h-3.5 w-3.5 rounded-full',
            'bg-white shadow-[0_0_8px_rgba(77,166,255,0.5)]',
            'border-2 border-[#0071E3]',
            'transition-transform duration-150',
            isHoveringTrack && 'scale-125',
          )}
          style={{ left: `${progress}%` }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />

        {/* Annotation markers */}
        {annotations.map((annotation) => {
          const position = duration > 0 ? (annotation.time / duration) * 100 : 0;
          return (
            <div
              key={annotation.id}
              className={clsx(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10',
                'h-2.5 w-2.5 rounded-full',
                'ring-2',
                annotationColors[annotation.type],
                annotationRingColors[annotation.type],
                'cursor-pointer transition-transform duration-150',
                'hover:scale-150',
              )}
              style={{ left: `${position}%` }}
              onMouseEnter={() => handleAnnotationEnter(annotation)}
              onMouseLeave={handleAnnotationLeave}
              onClick={(e) => handleAnnotationClick(annotation, e)}
            />
          );
        })}

        {/* Hover time indicator */}
        <AnimatePresence>
          {isHoveringTrack && !hoveredAnnotation && (
            <motion.div
              className={clsx(
                'absolute -top-8 -translate-x-1/2 z-20',
                'px-2 py-1 rounded-md',
                'bg-white shadow-sm',
                'border border-black/[0.06]',
                'text-[10px] font-mono text-[#6E6E73]',
                'pointer-events-none whitespace-nowrap',
              )}
              style={{ left: hoverX }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              {formatTime(hoverTime)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Annotation tooltip */}
        <AnimatePresence>
          {hoveredAnnotation && (
            <motion.div
              className={clsx(
                'absolute -top-10 -translate-x-1/2 z-20',
                'px-2.5 py-1.5 rounded-lg',
                'bg-white shadow-sm',
                'border border-black/[0.06]',
                'text-[11px] text-[#1D1D1F]',
                'pointer-events-none whitespace-nowrap',
                'shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
              )}
              style={{
                left: `${duration > 0 ? (hoveredAnnotation.time / duration) * 100 : 0}%`,
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <span className="font-medium">{hoveredAnnotation.label}</span>
              <span className="ml-1.5 text-[#86868B] font-mono text-[10px]">
                {formatTime(hoveredAnnotation.time)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
