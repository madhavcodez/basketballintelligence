'use client';

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Zap, ArrowRight } from 'lucide-react';
// ── Play type definitions ────────────────────────────────────────────────────

interface PlayDef {
  readonly color: string;
  readonly label: string;
  readonly description: string;
  readonly keyAction: string;
  readonly reads: readonly string[];
  readonly paths: readonly string[];
  readonly dots: readonly [number, number, string][]; // [cx, cy, role]
  readonly arrows: readonly string[];
}

const PLAYS: Record<string, PlayDef> = {
  isolation: {
    color: '#FF6B35', label: 'Isolation', keyAction: '1-on-1 attack',
    description: 'Ball handler creates space and attacks their defender one-on-one. Teammates clear out to give room.',
    reads: ['Beat defender off the dribble', 'Pull-up jumper if defender sags', 'Kick out if help comes'],
    paths: ['M 200 170 C 200 130 210 100 220 70'],
    dots: [[200, 170, 'Ball Handler'], [120, 220, 'Spacer'], [280, 220, 'Spacer'], [100, 120, 'Corner'], [300, 120, 'Corner']],
    arrows: ['M 200 170 L 210 100'],
  },
  'pick-and-roll': {
    color: '#0071E3', label: 'Pick & Roll', keyAction: 'Screen + roll action',
    description: 'Screener sets a pick on the ball handler\'s defender, then rolls to the basket. Forces a defensive switch or mismatch.',
    reads: ['Turn the corner if defender goes under', 'Pass to roller if big hedges', 'Pop to screener for mid-range'],
    paths: ['M 190 170 L 200 120', 'M 230 170 C 260 140 250 110 230 80'],
    dots: [[190, 170, 'Ball Handler'], [230, 170, 'Screener'], [120, 230, 'Wing'], [280, 230, 'Wing'], [200, 280, 'Corner']],
    arrows: ['M 190 170 L 200 120', 'M 230 170 L 230 90'],
  },
  'spot-up': {
    color: '#22C55E', label: 'Spot-Up', keyAction: 'Catch & shoot',
    description: 'Player receives a pass in a set position and immediately shoots. Premium looks from drive-and-kick actions.',
    reads: ['Shoot immediately on the catch', 'Shot fake and one-dribble pull-up', 'Relocate if closeout is hard'],
    paths: ['M 200 200 L 100 120', 'M 200 200 L 300 120'],
    dots: [[200, 200, 'Passer'], [100, 120, 'Shooter'], [300, 120, 'Shooter'], [80, 250, 'Corner'], [320, 250, 'Corner']],
    arrows: ['M 200 200 L 110 130', 'M 200 200 L 290 130'],
  },
  transition: {
    color: '#A78BFA', label: 'Transition', keyAction: 'Fast break attack',
    description: 'Push the ball up the court before the defense sets. Numbers advantage creates easy baskets.',
    reads: ['Run the lane for a layup', 'Trail for a 3-pointer', 'Pull up if defense recovers'],
    paths: ['M 200 380 L 200 80', 'M 140 360 L 120 120', 'M 260 360 L 280 120'],
    dots: [[200, 380, 'Ball Handler'], [140, 360, 'Wing'], [260, 360, 'Wing']],
    arrows: ['M 200 380 L 200 100', 'M 140 360 L 120 130', 'M 260 360 L 280 130'],
  },
  'post-up': {
    color: '#F59E0B', label: 'Post-Up', keyAction: 'Back-to-basket',
    description: 'Player establishes deep post position and works against their defender with footwork and counter moves.',
    reads: ['Drop step to the baseline', 'Face up and shoot over', 'Kick out to open shooters if doubled'],
    paths: ['M 170, 120 L 170 70'],
    dots: [[170, 120, 'Post Player'], [250, 120, 'Weak Side'], [200, 230, 'Point Guard'], [100, 180, 'Wing'], [300, 180, 'Wing']],
    arrows: ['M 170 120 L 170 75'],
  },
  'off-screen': {
    color: '#EF4444', label: 'Off Screen', keyAction: 'Screen away from ball',
    description: 'Player uses a screen set away from the ball to get open for a catch. Relies on precise timing and reading the defense.',
    reads: ['Curl tight for a layup', 'Fade to the corner if defender cheats', 'Straight cut if switch'],
    paths: ['M 260 190 C 240 160 210 160 180 180', 'M 180 180 L 120 100'],
    dots: [[260, 190, 'Cutter'], [210, 170, 'Screener'], [200, 260, 'Ball Handler'], [100, 100, 'Target'], [300, 200, 'Spacer']],
    arrows: ['M 260 190 L 130 110'],
  },
  handoff: {
    color: '#06B6D4', label: 'Handoff', keyAction: 'Dribble handoff exchange',
    description: 'Big man receives the ball at the top and hands it to a guard coming off their hip. Creates separation through body contact.',
    reads: ['Turn the corner off the handoff', 'Reject and go opposite', 'Screener pops if defender switches'],
    paths: ['M 180 150 L 220 150', 'M 220 150 L 250 90'],
    dots: [[180, 150, 'Screener'], [220, 150, 'Ball Handler'], [120, 230, 'Wing'], [280, 230, 'Wing'], [200, 290, 'Spacer']],
    arrows: ['M 180 150 L 220 150', 'M 220 150 L 250 90'],
  },
  cut: {
    color: '#34D399', label: 'Cut', keyAction: 'Basket cut',
    description: 'Player makes a sharp cut toward the basket, looking for a pass from the ball handler. Timing and backdoor reads are key.',
    reads: ['Backdoor if defender overplays', 'Front cut through the lane', 'Flash to the high post if lane is clogged'],
    paths: ['M 280 210 L 210 80'],
    dots: [[280, 210, 'Cutter'], [200, 180, 'Passer'], [120, 200, 'Wing'], [100, 120, 'Corner'], [300, 120, 'Corner']],
    arrows: ['M 280 210 L 215 85'],
  },
};

const DEFAULT_PLAY: PlayDef = {
  color: '#86868B', label: 'Play', keyAction: 'Action',
  description: 'Basketball play action.',
  reads: ['Read the defense', 'Make the right pass', 'Attack the opening'],
  paths: ['M 200 200 L 200 100'],
  dots: [[200, 200, 'Ball Handler'], [140, 250, 'Wing'], [260, 250, 'Wing']],
  arrows: ['M 200 200 L 200 110'],
};

// ── Props ────────────────────────────────────────────────────────────────────

interface PlayAnalysisModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly playType: string | null;
  readonly playerName?: string | null;
  readonly clipTitle?: string | null;
}

export default function PlayAnalysisModal({ open, onClose, playType, playerName, clipTitle }: PlayAnalysisModalProps) {
  const play = PLAYS[(playType ?? '').toLowerCase()] ?? DEFAULT_PLAY;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-analysis-title"
            className="relative w-full max-w-lg rounded-[24px] overflow-hidden"
            style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={stopProp}
          >
            {/* Header — dark */}
            <div className="relative bg-[#0C0C0E] px-6 pt-5 pb-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close play analysis"
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ background: play.color }} />
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: play.color }}>
                  Play Analysis
                </span>
              </div>
              <h2 id="play-analysis-title" className="text-xl font-display font-extrabold text-white tracking-tight">
                {play.label}
              </h2>
              {clipTitle && (
                <p className="text-xs text-white/30 mt-0.5">{clipTitle}</p>
              )}
              {playerName && (
                <p className="text-xs text-white/40 mt-0.5">{playerName}</p>
              )}
            </div>

            {/* Court Diagram */}
            <div className="bg-[#111113] px-6 py-5">
              <svg viewBox="0 0 400 320" className="w-full" preserveAspectRatio="xMidYMid meet">
                {/* Court background */}
                <rect x="20" y="10" width="360" height="300" rx="4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                {/* Paint */}
                <rect x="136" y="10" width="128" height="110" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                {/* Free throw circle */}
                <circle cx="200" cy="120" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
                {/* 3-point arc */}
                <path d="M 60 10 L 60 80 Q 60 230 200 230 Q 340 230 340 80 L 340 10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                {/* Basket */}
                <circle cx="200" cy="30" r="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                {/* Backboard */}
                <line x1="175" y1="20" x2="225" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

                {/* Play movement arrows — animated dashes */}
                {play.arrows.map((d, i) => (
                  <path
                    key={`arrow-${i}`}
                    d={d}
                    fill="none"
                    stroke={play.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="8 5"
                    opacity="0.7"
                  >
                    <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.5s" repeatCount="indefinite" />
                  </path>
                ))}

                {/* Screen lines */}
                {play.paths.map((d, i) => (
                  <path
                    key={`path-${i}`}
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeDasharray="4 3"
                  />
                ))}

                {/* Player dots with labels */}
                {play.dots.map(([cx, cy, role], i) => (
                  <g key={`dot-${i}`}>
                    {/* Glow ring for ball handler */}
                    {i === 0 && (
                      <circle cx={cx} cy={cy} r="14" fill="none" stroke={play.color} strokeWidth="1" opacity="0.3">
                        <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={cx} cy={cy}
                      r={i === 0 ? 10 : 7}
                      fill={i === 0 ? play.color : 'rgba(255,255,255,0.15)'}
                      stroke={i === 0 ? 'none' : 'rgba(255,255,255,0.08)'}
                      strokeWidth="1"
                    />
                    {/* Role label */}
                    <text
                      x={cx}
                      y={cy + (i === 0 ? 22 : 18)}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.35)"
                      fontSize="8"
                      fontFamily="system-ui"
                    >
                      {role}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Breakdown — white area */}
            <div className="bg-white px-6 py-5 space-y-4">
              {/* Key Action */}
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${play.color}15` }}>
                  <Zap size={16} style={{ color: play.color }} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">Key Action</p>
                  <p className="text-sm font-semibold text-[#1D1D1F]">{play.keyAction}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[#6E6E73] leading-relaxed">{play.description}</p>

              {/* Reads */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold mb-2 flex items-center gap-1.5">
                  <Target size={10} />
                  Decision Reads
                </p>
                <div className="space-y-1.5">
                  {play.reads.map((read, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-[#1D1D1F]">
                      <ArrowRight size={12} className="shrink-0 mt-0.5" style={{ color: play.color }} />
                      {read}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
