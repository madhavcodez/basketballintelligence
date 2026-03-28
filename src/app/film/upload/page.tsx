'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Film, Loader2 } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import UploadZone from '@/components/film/UploadZone';

// ── Types ────────────────────────────────────────────────────────────────────

interface GameContext {
  readonly gameDate: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly season: string;
  readonly playerFocus: string;
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Input Field Component ───────────────────────────────────────────────────

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly type?: string;
}

function GlassInput({ label, value, onChange, placeholder, type = 'text' }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full bg-white border border-black/[0.06]',
          'rounded-xl px-4 py-3',
          'text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50',
          'outline-none transition-all duration-200',
          'focus:border-[#0071E3]/40 focus:bg-[#F5F5F7]',
          'focus:shadow-[0_0_20px_rgba(77,166,255,0.12)]',
        )}
      />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadFilmPage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [gameContext, setGameContext] = useState<GameContext>({
    gameDate: '',
    homeTeam: '',
    awayTeam: '',
    season: '',
    playerFocus: '',
  });
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const updateGameContext = useCallback((field: keyof GameContext, value: string) => {
    setGameContext((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a video file first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Attach game context metadata
      if (gameContext.gameDate) formData.append('gameDate', gameContext.gameDate);
      if (gameContext.homeTeam) formData.append('homeTeam', gameContext.homeTeam);
      if (gameContext.awayTeam) formData.append('awayTeam', gameContext.awayTeam);
      if (gameContext.season) formData.append('season', gameContext.season);
      if (gameContext.playerFocus) formData.append('playerFocus', gameContext.playerFocus);

      // Simulate progress (real XHR progress would use XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev === undefined) return 10;
          if (prev >= 85) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);

      const res = await fetch('/api/film/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? 'Upload failed. Please try again.');
        setUploadProgress(undefined);
        setIsSubmitting(false);
        return;
      }

      setUploadProgress(100);
      const { videoId } = await res.json();

      // Brief pause to show completion state, then redirect
      setTimeout(() => {
        router.push('/film');
      }, 1200);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setUploadProgress(undefined);
      setIsSubmitting(false);
    }
  }, [selectedFile, gameContext, router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-24">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* ── Back Button ───────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-6">
          <Link
            href="/film"
            className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors"
          >
            <ArrowLeft size={12} /> Back to Film Room
          </Link>
        </motion.div>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Upload size={24} className="text-[#FF6B35]" />
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[#1D1D1F]">
              Upload Film
            </h1>
          </div>
          <p className="text-sm text-[#86868B]">
            Add game footage to your library for AI-powered analysis.
          </p>
        </motion.div>

        {/* ── Upload Zone ───────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            progress={uploadProgress}
          />
        </motion.div>

        {/* ── Game Context Form ─────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="mb-8">
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Film size={16} className="text-[#86868B]" />
              <h2 className="text-sm font-bold text-[#6E6E73] uppercase tracking-wider">
                Game Context
              </h2>
              <span className="text-[10px] text-[#86868B]/50 ml-1">(optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput
                label="Game Date"
                type="date"
                value={gameContext.gameDate}
                onChange={(v) => updateGameContext('gameDate', v)}
                placeholder=""
              />
              <GlassInput
                label="Season"
                value={gameContext.season}
                onChange={(v) => updateGameContext('season', v)}
                placeholder="2024-25"
              />
              <GlassInput
                label="Home Team"
                value={gameContext.homeTeam}
                onChange={(v) => updateGameContext('homeTeam', v)}
                placeholder="Lakers"
              />
              <GlassInput
                label="Away Team"
                value={gameContext.awayTeam}
                onChange={(v) => updateGameContext('awayTeam', v)}
                placeholder="Celtics"
              />
              <div className="sm:col-span-2">
                <GlassInput
                  label="Player Focus"
                  value={gameContext.playerFocus}
                  onChange={(v) => updateGameContext('playerFocus', v)}
                  placeholder="LeBron James"
                />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Error Message ─────────────────────────────────────────────── */}
        {error && (
          <motion.div
            className="mb-6 px-4 py-3 rounded-xl bg-[#EF4444]/[0.06] border border-[#EF4444]/20"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <p className="text-sm text-[#EF4444] font-medium">{error}</p>
          </motion.div>
        )}

        {/* ── Submit Button ────────────────────────────────────────────── */}
        <motion.div variants={fadeSlideUp} className="flex justify-center">
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || isSubmitting}
            whileHover={selectedFile && !isSubmitting ? { scale: 1.02 } : undefined}
            whileTap={selectedFile && !isSubmitting ? { scale: 0.97 } : undefined}
            className={clsx(
              'flex items-center gap-2.5 px-8 py-3.5 rounded-full',
              'text-sm font-bold tracking-wide transition-all duration-200',
              selectedFile && !isSubmitting
                ? 'bg-[#FF6B35] text-white shadow-[0_0_20px_rgba(255,107,53,0.25)] hover:shadow-[0_0_30px_rgba(255,107,53,0.35)]'
                : 'bg-white border border-black/[0.06] text-[#86868B] cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {uploadProgress !== undefined && uploadProgress >= 100 ? 'Processing...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload &amp; Analyze
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
