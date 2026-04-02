'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Loader2, Clapperboard, Sparkles } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import UploadZone from '@/components/film/UploadZone';
import TeamLogo from '@/components/ui/TeamLogo';

// ── Types ────────────────────────────────────────────────────────────────────

interface GameContext {
  readonly gameDate: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly season: string;
  readonly playerFocus: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadFilmPage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [gameContext, setGameContext] = useState<GameContext>({
    gameDate: '', homeTeam: '', awayTeam: '', season: '', playerFocus: '',
  });
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const updateGameContext = useCallback((field: keyof GameContext, value: string) => {
    setGameContext((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) { setError('Drop a video file onto the stage first.'); return; }
    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (gameContext.gameDate) formData.append('gameDate', gameContext.gameDate);
      if (gameContext.homeTeam) formData.append('homeTeam', gameContext.homeTeam);
      if (gameContext.awayTeam) formData.append('awayTeam', gameContext.awayTeam);
      if (gameContext.season) formData.append('season', gameContext.season);
      if (gameContext.playerFocus) formData.append('playerFocus', gameContext.playerFocus);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev === undefined) return 10;
          return prev >= 85 ? prev : prev + Math.random() * 15;
        });
      }, 300);

      const res = await fetch('/api/film/upload', { method: 'POST', body: formData });
      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? 'Upload failed.');
        setUploadProgress(undefined);
        setIsSubmitting(false);
        return;
      }

      setUploadProgress(100);
      setTimeout(() => router.push('/film'), 1200);
    } catch {
      setError('Network error. Check your connection.');
      setUploadProgress(undefined);
      setIsSubmitting(false);
    }
  }, [selectedFile, gameContext, router]);

  const showContextForm = !!selectedFile;

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col">
      {/* ── Back link ──────────────────────────────────────────────── */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4">
        <Link
          href="/film"
          className="inline-flex items-center gap-1 text-xs text-[#86868B] hover:text-[#6E6E73] transition-colors"
        >
          <ArrowLeft size={12} /> Film Room
        </Link>
      </div>

      {/* ── Theater Stage ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 16 }}
        >
          {/* Stage container — dark theater look */}
          <div className="relative rounded-[28px] overflow-hidden">
            {/* Spotlight gradient behind the stage */}
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(255,107,53,0.08) 0%, rgba(0,0,0,0) 60%), linear-gradient(to bottom, #111113, #0A0A0C)',
              }}
            />

            {/* Stage content */}
            <div className="relative px-6 sm:px-10 pt-10 pb-8">
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(0,113,227,0.15))' }}
                  animate={{ boxShadow: ['0 0 20px rgba(255,107,53,0.1)', '0 0 40px rgba(0,113,227,0.15)', '0 0 20px rgba(255,107,53,0.1)'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Clapperboard size={28} className="text-white/70" />
                </motion.div>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white mb-2">
                  Add to Film Room
                </h1>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Drop game footage onto the stage. AI will tag plays, detect events, and break it down frame by frame.
                </p>
              </div>

              {/* Drop zone — the spotlight area */}
              <div className="relative mb-6">
                {/* Spotlight ring */}
                <div
                  className="absolute -inset-1 rounded-[20px] opacity-30"
                  style={{
                    background: selectedFile
                      ? 'linear-gradient(135deg, #22C55E40, #22C55E10)'
                      : 'linear-gradient(135deg, #FF6B3540, #0071E340)',
                  }}
                />
                <div className="relative rounded-[18px] overflow-hidden bg-white/[0.03] border border-white/[0.08]">
                  <UploadZone onFileSelect={handleFileSelect} progress={uploadProgress} />
                </div>

                {/* File selected indicator */}
                {selectedFile && !isSubmitting && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center justify-center gap-2 text-xs text-[#34D399]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </motion.div>
                )}
              </div>

              {/* ── Game Context — slides in after file selected ──────── */}
              <AnimatePresence>
                {showContextForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 pb-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={12} className="text-white/30" />
                        <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                          Game Context <span className="text-white/15">(optional — improves AI tagging)</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <StageInput label="Home Team" value={gameContext.homeTeam} onChange={(v) => updateGameContext('homeTeam', v)} placeholder="LAL"
                          adornment={gameContext.homeTeam.length >= 2 ? <TeamLogo teamAbbr={gameContext.homeTeam} size="sm" /> : undefined}
                        />
                        <StageInput label="Away Team" value={gameContext.awayTeam} onChange={(v) => updateGameContext('awayTeam', v)} placeholder="BOS"
                          adornment={gameContext.awayTeam.length >= 2 ? <TeamLogo teamAbbr={gameContext.awayTeam} size="sm" /> : undefined}
                        />
                        <StageInput label="Game Date" type="date" value={gameContext.gameDate} onChange={(v) => updateGameContext('gameDate', v)} placeholder="" />
                        <StageInput label="Season" value={gameContext.season} onChange={(v) => updateGameContext('season', v)} placeholder="2024-25" />
                        <div className="col-span-2">
                          <StageInput label="Player Focus" value={gameContext.playerFocus} onChange={(v) => updateGameContext('playerFocus', v)} placeholder="LeBron James" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Error ──────────────────────────────────────────────── */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-[#EF4444] text-center mt-4"
                >
                  {error}
                </motion.p>
              )}

              {/* ── Submit Button ──────────────────────────────────────── */}
              <motion.div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedFile || isSubmitting}
                  className={clsx(
                    'relative flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold transition-all duration-200',
                    selectedFile && !isSubmitting
                      ? 'bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 hover:shadow-[0_0_30px_rgba(255,107,53,0.3)] active:scale-95'
                      : 'bg-white/[0.06] text-white/20 cursor-not-allowed',
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Analyze Film
                    </>
                  )}
                </button>
              </motion.div>

              {/* Progress bar */}
              {uploadProgress !== undefined && (
                <motion.div
                  className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: uploadProgress >= 100 ? '#34D399' : 'linear-gradient(90deg, #FF6B35, #0071E3)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Supported formats hint */}
          <p className="text-center text-[10px] text-[#86868B]/50 mt-4">
            MP4, MOV, WebM up to 2 GB
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── Stage Input — dark-themed input for the theater context ──────────────────

function StageInput({
  label, value, onChange, placeholder, type = 'text', adornment,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder: string;
  readonly type?: string;
  readonly adornment?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-wider text-white/25 font-semibold mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        {adornment && <div className="absolute left-2.5 z-10">{adornment}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder:text-white/15',
            'outline-none transition-all duration-200',
            'focus:border-[#FF6B35]/30 focus:bg-white/[0.06]',
            adornment ? 'pl-9 pr-3 py-2.5' : 'px-3 py-2.5',
          )}
        />
      </div>
    </div>
  );
}
