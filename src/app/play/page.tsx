'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  HelpCircle,
  Scale,
  Trophy,
  Flame,
  Timer,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Zap,
  Crown,
  Target,
} from 'lucide-react';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';
import { useSeasonType } from '@/lib/season-context';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuizPlayer {
  readonly name: string;
  readonly team: string;
  readonly season: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly blocks: number;
  readonly games: number;
  readonly fgPct: number;
  readonly fg3Pct: number;
}

interface ComparePair {
  readonly name: string;
  readonly team: string;
  readonly season: string;
  readonly points: number;
  readonly rebounds: number;
  readonly assists: number;
  readonly games: number;
}

type GameMode = 'select' | 'guess' | 'compare';

type CompareStat = 'points' | 'rebounds' | 'assists';

const COMPARE_STAT_LABELS: Record<CompareStat, string> = {
  points: 'PPG',
  rebounds: 'RPG',
  assists: 'APG',
};

const TOTAL_QUESTIONS = 10;
const TIMER_SECONDS = 15;

// ── Leaderboard ──────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  readonly score: number;
  readonly accuracy: number;
  readonly date: string;
}

function getLeaderboard(mode: 'guess' | 'compare'): readonly LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`bball-play-${mode}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLeaderboard(mode: 'guess' | 'compare', entry: LeaderboardEntry): readonly LeaderboardEntry[] {
  const existing = [...getLeaderboard(mode)];
  existing.push(entry);
  const sorted = existing.sort((a, b) => b.score - a.score).slice(0, 5);
  try {
    localStorage.setItem(`bball-play-${mode}`, JSON.stringify(sorted));
  } catch {
    // localStorage unavailable
  }
  return sorted;
}

// ── Guess Game State ─────────────────────────────────────────────────────────

interface GuessState {
  readonly status: 'loading' | 'playing' | 'answered' | 'gameover';
  readonly currentPlayer: QuizPlayer | null;
  readonly options: readonly string[];
  readonly correctAnswer: string;
  readonly selectedAnswer: string | null;
  readonly questionNumber: number;
  readonly score: number;
  readonly streak: number;
  readonly maxStreak: number;
  readonly timeRemaining: number;
  readonly history: readonly boolean[];
}

type GuessAction =
  | { type: 'LOAD_QUESTION'; player: QuizPlayer; options: string[] }
  | { type: 'ANSWER'; answer: string }
  | { type: 'TICK' }
  | { type: 'TIMEOUT' }
  | { type: 'NEXT' }
  | { type: 'RESET' };

function guessReducer(state: GuessState, action: GuessAction): GuessState {
  switch (action.type) {
    case 'LOAD_QUESTION':
      return {
        ...state,
        status: 'playing',
        currentPlayer: action.player,
        options: action.options,
        correctAnswer: action.player.name,
        selectedAnswer: null,
        timeRemaining: TIMER_SECONDS,
      };
    case 'ANSWER': {
      const isCorrect = action.answer === state.correctAnswer;
      return {
        ...state,
        status: 'answered',
        selectedAnswer: action.answer,
        score: isCorrect ? state.score + 1 : state.score,
        streak: isCorrect ? state.streak + 1 : 0,
        maxStreak: isCorrect ? Math.max(state.maxStreak, state.streak + 1) : state.maxStreak,
        history: [...state.history, isCorrect],
      };
    }
    case 'TICK':
      return {
        ...state,
        timeRemaining: Math.max(0, state.timeRemaining - 1),
      };
    case 'TIMEOUT':
      return {
        ...state,
        status: 'answered',
        selectedAnswer: null,
        streak: 0,
        history: [...state.history, false],
      };
    case 'NEXT':
      if (state.questionNumber >= TOTAL_QUESTIONS) {
        return { ...state, status: 'gameover' };
      }
      return {
        ...state,
        status: 'loading',
        questionNumber: state.questionNumber + 1,
      };
    case 'RESET':
      return {
        status: 'loading',
        currentPlayer: null,
        options: [],
        correctAnswer: '',
        selectedAnswer: null,
        questionNumber: 1,
        score: 0,
        streak: 0,
        maxStreak: 0,
        timeRemaining: TIMER_SECONDS,
        history: [],
      };
    default:
      return state;
  }
}

const initialGuessState: GuessState = {
  status: 'loading',
  currentPlayer: null,
  options: [],
  correctAnswer: '',
  selectedAnswer: null,
  questionNumber: 1,
  score: 0,
  streak: 0,
  maxStreak: 0,
  timeRemaining: TIMER_SECONDS,
  history: [],
};

// ── Compare Game State ───────────────────────────────────────────────────────

interface CompareState {
  readonly status: 'loading' | 'playing' | 'answered' | 'gameover';
  readonly players: readonly ComparePair[];
  readonly compareStat: CompareStat;
  readonly selectedIdx: number | null;
  readonly correctIdx: number;
  readonly questionNumber: number;
  readonly score: number;
  readonly streak: number;
  readonly maxStreak: number;
  readonly history: readonly boolean[];
}

type CompareAction =
  | { type: 'LOAD_QUESTION'; players: ComparePair[]; stat: CompareStat }
  | { type: 'ANSWER'; idx: number }
  | { type: 'NEXT' }
  | { type: 'RESET' };

function compareReducer(state: CompareState, action: CompareAction): CompareState {
  switch (action.type) {
    case 'LOAD_QUESTION': {
      const vals = action.players.map((p) => Number(p[action.stat]) || 0);
      const correctIdx = vals[0] >= vals[1] ? 0 : 1;
      return {
        ...state,
        status: 'playing',
        players: action.players,
        compareStat: action.stat,
        selectedIdx: null,
        correctIdx,
      };
    }
    case 'ANSWER': {
      const isCorrect = action.idx === state.correctIdx;
      return {
        ...state,
        status: 'answered',
        selectedIdx: action.idx,
        score: isCorrect ? state.score + 1 : state.score,
        streak: isCorrect ? state.streak + 1 : 0,
        maxStreak: isCorrect ? Math.max(state.maxStreak, state.streak + 1) : state.maxStreak,
        history: [...state.history, isCorrect],
      };
    }
    case 'NEXT':
      if (state.questionNumber >= TOTAL_QUESTIONS) {
        return { ...state, status: 'gameover' };
      }
      return {
        ...state,
        status: 'loading',
        questionNumber: state.questionNumber + 1,
      };
    case 'RESET':
      return {
        status: 'loading',
        players: [],
        compareStat: 'points',
        selectedIdx: null,
        correctIdx: 0,
        questionNumber: 1,
        score: 0,
        streak: 0,
        maxStreak: 0,
        history: [],
      };
    default:
      return state;
  }
}

const initialCompareState: CompareState = {
  status: 'loading',
  players: [],
  compareStat: 'points',
  selectedIdx: null,
  correctIdx: 0,
  questionNumber: 1,
  score: 0,
  streak: 0,
  maxStreak: 0,
  history: [],
};

// ── Animations ───────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
  },
};

// ── Helper: Generate fake options ────────────────────────────────────────────

const DECOY_NAMES = [
  'LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo',
  'Luka Doncic', 'Jayson Tatum', 'Joel Embiid', 'Nikola Jokic',
  'Damian Lillard', 'Jimmy Butler', 'Devin Booker', 'Anthony Edwards',
  'Ja Morant', 'Donovan Mitchell', 'Trae Young', 'Shai Gilgeous-Alexander',
  'Tyrese Haliburton', 'Paolo Banchero', 'Victor Wembanyama', 'Anthony Davis',
  'Paul George', 'Kawhi Leonard', 'Kyrie Irving', 'James Harden',
  'De\'Aaron Fox', 'Zion Williamson', 'Bam Adebayo', 'Karl-Anthony Towns',
  'Jalen Brunson', 'Chet Holmgren',
];

function generateOptions(correctName: string): string[] {
  const pool = DECOY_NAMES.filter((n) => n !== correctName);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const decoys = shuffled.slice(0, 3);
  const all = [correctName, ...decoys].sort(() => Math.random() - 0.5);
  return all;
}

function randomCompareStat(): CompareStat {
  const stats: CompareStat[] = ['points', 'rebounds', 'assists'];
  return stats[Math.floor(Math.random() * stats.length)];
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  questionNumber,
  score,
  streak,
  history,
  mode,
}: {
  readonly questionNumber: number;
  readonly score: number;
  readonly streak: number;
  readonly history: readonly boolean[];
  readonly mode: 'guess' | 'compare';
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Target size={14} className="text-[#86868B]" />
            <span className="text-xs text-[#86868B]">Q</span>
            <span className="text-sm font-bold text-[#1D1D1F] font-display font-mono">
              {questionNumber}/{TOTAL_QUESTIONS}
            </span>
          </div>
          <div className="w-px h-4 bg-black/[0.06]" />
          <div className="flex items-center gap-1.5">
            <Trophy size={14} className="text-[#F59E0B]" />
            <span className="text-sm font-bold text-[#F59E0B] font-display font-mono">{score}</span>
          </div>
        </div>
        {streak > 1 && (
          <motion.div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20 shadow-[0_0_16px_rgba(255,107,53,0.2)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <Flame size={14} className="text-[#FF6B35]" />
            <span className="text-xs font-extrabold text-[#FF6B35] font-mono">{streak}</span>
          </motion.div>
        )}
      </div>
      {/* Answer history dots */}
      {history.length > 0 && (
        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => {
            const answered = i < history.length;
            const correct = answered ? history[i] : null;
            return (
              <motion.div
                key={`hist-${mode}-${i}`}
                className={clsx(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  !answered && 'bg-[#F5F5F7]',
                  answered && correct && 'bg-[#22C55E]',
                  answered && !correct && 'bg-[#EF4444]',
                )}
                initial={answered ? { scale: 0.5, opacity: 0 } : false}
                animate={answered ? { scale: 1, opacity: 1 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Timer Ring ───────────────────────────────────────────────────────────────

function TimerRing({ seconds, total }: { readonly seconds: number; readonly total: number }) {
  const pct = seconds / total;
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const isLow = seconds <= 5;

  return (
    <div className={clsx('relative flex items-center justify-center w-12 h-12', isLow && '')}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={isLow ? '#F87171' : '#FF6B35'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
          className="transition-all duration-1000 linear"
        />
      </svg>
      <span className={clsx(
        'absolute text-base font-extrabold font-display',
        isLow ? 'text-[#EF4444]' : 'text-[#1D1D1F]',
      )}>
        {seconds}
      </span>
    </div>
  );
}

// ── Feedback Flash ───────────────────────────────────────────────────────────

function FeedbackFlash({ correct }: { readonly correct: boolean }) {
  return (
    <motion.div
      className={clsx(
        'fixed inset-0 z-50 pointer-events-none',
        correct ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10',
      )}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    />
  );
}

// ── Guess The Player Game ────────────────────────────────────────────────────

function GuessThePlayerGame({ onBack }: { readonly onBack: () => void }) {
  const { seasonType } = useSeasonType();
  const [state, dispatch] = useReducer(guessReducer, initialGuessState);
  const [showFeedback, setShowFeedback] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<readonly LeaderboardEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load leaderboard
  useEffect(() => {
    setLeaderboard(getLeaderboard('guess'));
  }, []);

  // Fetch question
  const fetchQuestion = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/quiz?mode=guess&seasonType=${seasonType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const player: QuizPlayer = json.data;
      const options = generateOptions(player.name);
      dispatch({ type: 'LOAD_QUESTION', player, options });
    } catch {
      // Retry after a short delay
      setTimeout(fetchQuestion, 1000);
    }
  }, [seasonType]);

  // Load first question and subsequent ones
  useEffect(() => {
    if (state.status === 'loading') {
      fetchQuestion();
    }
  }, [state.status, fetchQuestion]);

  // Timer
  useEffect(() => {
    if (state.status === 'playing') {
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [state.status]);

  // Timeout check
  useEffect(() => {
    if (state.status === 'playing' && state.timeRemaining <= 0) {
      dispatch({ type: 'TIMEOUT' });
      setShowFeedback(false);
      setTimeout(() => setShowFeedback(null), 600);
    }
  }, [state.timeRemaining, state.status]);

  const handleAnswer = useCallback((answer: string) => {
    if (state.status !== 'playing') return;
    dispatch({ type: 'ANSWER', answer });
    const isCorrect = answer === state.correctAnswer;
    setShowFeedback(isCorrect);
    setTimeout(() => setShowFeedback(null), 600);
  }, [state.status, state.correctAnswer]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Save score on game over
  useEffect(() => {
    if (state.status === 'gameover') {
      const accuracy = state.history.length > 0
        ? Math.round((state.score / state.history.length) * 100)
        : 0;
      const updated = saveToLeaderboard('guess', {
        score: state.score,
        accuracy,
        date: new Date().toLocaleDateString(),
      });
      setLeaderboard(updated);
    }
  }, [state.status, state.score, state.history]);

  // Game Over Screen
  if (state.status === 'gameover') {
    const accuracy = state.history.length > 0
      ? Math.round((state.score / state.history.length) * 100)
      : 0;

    return (
      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <GlassCard className="p-8 sm:p-10 text-center" tintColor="#FF6B35">
          <Crown size={48} className="text-[#F59E0B] mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] text-[#1D1D1F] font-display">Game Over!</h2>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold font-display text-[#FF6B35]">{state.score}</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Score</div>
            </div>
            <div className="w-px h-14 bg-black/[0.06]" />
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold text-[#0071E3] font-display">{accuracy}%</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Accuracy</div>
            </div>
            <div className="w-px h-14 bg-black/[0.06]" />
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold text-[#22C55E] font-display">{state.maxStreak}</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Best Streak</div>
            </div>
          </div>
          <div className="mt-8 flex gap-3 justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF6B35]/[0.08] border border-[#FF6B35]/30 text-sm font-semibold text-[#FF6B35] hover:bg-[#FF6B35]/[0.12] transition-colors"
            >
              <RotateCcw size={16} />
              Play Again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-black/[0.06] text-sm font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors"
            >
              Game Modes
            </button>
          </div>
        </GlassCard>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-[#1D1D1F] mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-[#F59E0B]" />
              Top Scores - Guess the Player
            </h3>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={`${entry.date}-${entry.score}-${i}`} className="flex items-center gap-3 text-xs">
                  <span className="w-5 text-right text-[#86868B] font-mono font-bold">{i + 1}</span>
                  <span className="flex-1 text-[#1D1D1F] font-medium">{entry.score}/{TOTAL_QUESTIONS}</span>
                  <span className="text-[#6E6E73]">{entry.accuracy}%</span>
                  <span className="text-[#86868B]">{entry.date}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </motion.div>
    );
  }

  // Loading
  if (state.status === 'loading' || !state.currentPlayer) {
    return (
      <div className="space-y-4">
        <SkeletonLoader height={48} rounded="xl" />
        <SkeletonLoader height={200} rounded="xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader key={i} height={48} rounded="xl" />
          ))}
        </div>
      </div>
    );
  }

  const p = state.currentPlayer;
  const isAnswered = state.status === 'answered';

  return (
    <div className="space-y-4">
      {showFeedback !== null && <FeedbackFlash correct={showFeedback} />}

      <ScoreBar
        questionNumber={state.questionNumber}
        score={state.score}
        streak={state.streak}
        history={state.history}
        mode="guess"
      />

      {/* Timer + Stats Card */}
      <GlassCard className="p-5" tintColor="#4DA6FF">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-xs text-[#86868B] uppercase tracking-wider">Who is this player?</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-[#6E6E73]">{p.team}</span>
              <span className="text-[#86868B]">|</span>
              <span className="text-sm text-[#6E6E73]">{p.season}</span>
            </div>
          </div>
          {!isAnswered && (
            <TimerRing seconds={state.timeRemaining} total={TIMER_SECONDS} />
          )}
          {isAnswered && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              {state.selectedAnswer === state.correctAnswer ? (
                <CheckCircle2 size={36} className="text-[#22C55E]" />
              ) : (
                <XCircle size={36} className="text-[#EF4444]" />
              )}
            </motion.div>
          )}
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'PPG', value: Number(p.points).toFixed(1) },
            { label: 'RPG', value: Number(p.rebounds).toFixed(1) },
            { label: 'APG', value: Number(p.assists).toFixed(1) },
            { label: 'FG%', value: `${(Number(p.fgPct) < 1 ? Number(p.fgPct) * 100 : Number(p.fgPct)).toFixed(1)}` },
            { label: 'GP', value: String(p.games) },
            { label: 'STL', value: Number(p.steals).toFixed(1) },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-lg sm:text-xl font-bold text-[#1D1D1F] font-display">{stat.value}</div>
              <div className="text-[10px] text-[#86868B] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Revealed name */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              className="mt-4 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            >
              <span className="text-xl font-extrabold text-[#FF6B35] font-display">{state.correctAnswer}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {state.options.map((option) => {
          const isSelected = state.selectedAnswer === option;
          const isCorrect = option === state.correctAnswer;
          let variant = 'default';
          if (isAnswered) {
            if (isCorrect) variant = 'correct';
            else if (isSelected) variant = 'wrong';
          }

          return (
            <motion.button
              key={option}
              type="button"
              onClick={() => handleAnswer(option)}
              disabled={isAnswered}
              className={clsx(
                'relative px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200',
                'border text-left',
                variant === 'default' && 'bg-white border-black/[0.12] text-[#1D1D1F] hover:bg-[#F5F5F7] hover:border-black/[0.12]',
                variant === 'correct' && 'bg-[#22C55E] border-[#22C55E] text-white',
                variant === 'wrong' && 'bg-[#EF4444] border-[#EF4444] text-white',
                isAnswered && variant === 'default' && 'opacity-50',
              )}
              whileTap={!isAnswered ? { scale: 0.97 } : undefined}
              animate={variant === 'wrong' ? { x: [0, -4, 4, -4, 4, 0] } : undefined}
              transition={variant === 'wrong' ? { duration: 0.4 } : undefined}
            >
              {option}
              {isAnswered && isCorrect && (
                <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#22C55E]" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Next button */}
      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            type="button"
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#FF6B35]/[0.08] border border-[#FF6B35]/30 text-sm font-semibold text-[#FF6B35] hover:bg-[#FF6B35]/[0.12] transition-colors"
          >
            {state.questionNumber >= TOTAL_QUESTIONS ? 'See Results' : 'Next Question'}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Better Season Game ───────────────────────────────────────────────────────

function BetterSeasonGame({ onBack }: { readonly onBack: () => void }) {
  const { seasonType } = useSeasonType();
  const [state, dispatch] = useReducer(compareReducer, initialCompareState);
  const [showFeedback, setShowFeedback] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<readonly LeaderboardEntry[]>([]);

  useEffect(() => {
    setLeaderboard(getLeaderboard('compare'));
  }, []);

  const fetchQuestion = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/quiz?mode=compare&seasonType=${seasonType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const players: ComparePair[] = json.data;
      if (!players || players.length < 2) throw new Error('Invalid data');
      const stat = randomCompareStat();
      dispatch({ type: 'LOAD_QUESTION', players, stat });
    } catch {
      setTimeout(fetchQuestion, 1000);
    }
  }, [seasonType]);

  useEffect(() => {
    if (state.status === 'loading') {
      fetchQuestion();
    }
  }, [state.status, fetchQuestion]);

  const handleAnswer = useCallback((idx: number) => {
    if (state.status !== 'playing') return;
    dispatch({ type: 'ANSWER', idx });
    const isCorrect = idx === state.correctIdx;
    setShowFeedback(isCorrect);
    setTimeout(() => setShowFeedback(null), 600);
  }, [state.status, state.correctIdx]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Save score
  useEffect(() => {
    if (state.status === 'gameover') {
      const accuracy = state.history.length > 0
        ? Math.round((state.score / state.history.length) * 100)
        : 0;
      const updated = saveToLeaderboard('compare', {
        score: state.score,
        accuracy,
        date: new Date().toLocaleDateString(),
      });
      setLeaderboard(updated);
    }
  }, [state.status, state.score, state.history]);

  // Game Over
  if (state.status === 'gameover') {
    const accuracy = state.history.length > 0
      ? Math.round((state.score / state.history.length) * 100)
      : 0;

    return (
      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <GlassCard className="p-8 sm:p-10 text-center" tintColor="#4DA6FF">
          <Crown size={48} className="text-[#F59E0B] mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] text-[#1D1D1F] font-display">Game Over!</h2>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold font-display text-[#0071E3]">{state.score}</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Score</div>
            </div>
            <div className="w-px h-14 bg-black/[0.06]" />
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold text-[#FF6B35] font-display">{accuracy}%</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Accuracy</div>
            </div>
            <div className="w-px h-14 bg-black/[0.06]" />
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold text-[#22C55E] font-display">{state.maxStreak}</div>
              <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1.5">Best Streak</div>
            </div>
          </div>
          <div className="mt-8 flex gap-3 justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0071E3]/[0.08] border border-[#0071E3]/30 text-sm font-semibold text-[#0071E3] hover:bg-[#0071E3]/[0.12] transition-colors"
            >
              <RotateCcw size={16} />
              Play Again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-black/[0.06] text-sm font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors"
            >
              Game Modes
            </button>
          </div>
        </GlassCard>

        {leaderboard.length > 0 && (
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-[#1D1D1F] mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-[#F59E0B]" />
              Top Scores - Better Season
            </h3>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={`${entry.date}-${entry.score}-${i}`} className="flex items-center gap-3 text-xs">
                  <span className="w-5 text-right text-[#86868B] font-mono font-bold">{i + 1}</span>
                  <span className="flex-1 text-[#1D1D1F] font-medium">{entry.score}/{TOTAL_QUESTIONS}</span>
                  <span className="text-[#6E6E73]">{entry.accuracy}%</span>
                  <span className="text-[#86868B]">{entry.date}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </motion.div>
    );
  }

  // Loading
  if (state.status === 'loading' || state.players.length < 2) {
    return (
      <div className="space-y-4">
        <SkeletonLoader height={48} rounded="xl" />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonLoader height={220} rounded="xl" />
          <SkeletonLoader height={220} rounded="xl" />
        </div>
      </div>
    );
  }

  const isAnswered = state.status === 'answered';
  const statLabel = COMPARE_STAT_LABELS[state.compareStat];

  return (
    <div className="space-y-4">
      {showFeedback !== null && <FeedbackFlash correct={showFeedback} />}

      <ScoreBar
        questionNumber={state.questionNumber}
        score={state.score}
        streak={state.streak}
        history={state.history}
        mode="compare"
      />

      {/* Question prompt */}
      <div className="text-center py-2">
        <span className="text-xs text-[#86868B] uppercase tracking-wider">Who had the better</span>
        <div className="text-xl font-extrabold text-[#0071E3] font-display mt-0.5">{statLabel}?</div>
      </div>

      {/* Player cards side by side */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {state.players.map((player, idx) => {
          const isSelected = state.selectedIdx === idx;
          const isCorrectPlayer = idx === state.correctIdx;
          let borderColor = 'border-black/[0.06]';
          let bgColor = 'bg-white';
          let shadowClass = '';

          if (isAnswered) {
            if (isCorrectPlayer) {
              borderColor = 'border-[#22C55E]/40';
              bgColor = 'bg-[#22C55E]/[0.06]';
              shadowClass = 'shadow-[0_0_20px_rgba(52,211,153,0.15)]';
            } else if (isSelected) {
              borderColor = 'border-[#EF4444]/40';
              bgColor = 'bg-[#EF4444]/[0.06]';
            }
          }

          return (
            <motion.button
              key={`${player.name}-${player.season}`}
              type="button"
              onClick={() => handleAnswer(idx)}
              disabled={isAnswered}
              className={clsx(
                'relative flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl text-center transition-all duration-200',
                'border ',
                bgColor,
                borderColor,
                shadowClass,
                !isAnswered && 'hover:bg-[#F5F5F7] hover:border-black/[0.12] cursor-pointer',
                isAnswered && !isCorrectPlayer && !isSelected && 'opacity-50',
              )}
              whileTap={!isAnswered ? { scale: 0.97 } : undefined}
              animate={isAnswered && isSelected && !isCorrectPlayer ? { x: [0, -4, 4, -4, 4, 0] } : undefined}
              transition={isAnswered && isSelected && !isCorrectPlayer ? { duration: 0.4 } : undefined}
            >
              <PlayerAvatar name={player.name} size="lg" />
              <div>
                <div className="text-sm font-bold text-[#1D1D1F]">{player.name}</div>
                <div className="flex items-center gap-1 text-[10px] text-[#86868B] mt-0.5">
                  <TeamLogo teamAbbr={player.team} size="sm" />
                  {player.team} | {player.season}
                </div>
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-3 gap-1 mt-1">
                {[
                  { label: 'PPG', val: Number(player.points).toFixed(1), isFocused: state.compareStat === 'points' },
                  { label: 'RPG', val: Number(player.rebounds).toFixed(1), isFocused: state.compareStat === 'rebounds' },
                  { label: 'APG', val: Number(player.assists).toFixed(1), isFocused: state.compareStat === 'assists' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className={clsx(
                      'text-sm font-bold font-display',
                      isAnswered && s.isFocused && isCorrectPlayer ? 'text-[#22C55E]' : 'text-[#1D1D1F]',
                    )}>
                      {isAnswered || !s.isFocused ? s.val : '?'}
                    </div>
                    <div className={clsx(
                      'text-[9px] uppercase tracking-wider mt-0.5',
                      s.isFocused ? 'text-[#0071E3]' : 'text-[#86868B]',
                    )}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Answer indicator */}
              {isAnswered && isCorrectPlayer && (
                <motion.div
                  className="absolute -top-2 -right-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  <CheckCircle2 size={24} className="text-[#22C55E] bg-[#FAFAFA] rounded-full" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Comparison bar (revealed) */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <GlassCard className="p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[#6E6E73] font-medium">{state.players[0].name.split(' ').pop()}</span>
                <span className="text-[#86868B] uppercase tracking-wider font-semibold">{statLabel}</span>
                <span className="text-[#6E6E73] font-medium">{state.players[1].name.split(' ').pop()}</span>
              </div>
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-6 rounded-l-full bg-[#FF6B35]/60"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(Number(state.players[0][state.compareStat]) / (Number(state.players[0][state.compareStat]) + Number(state.players[1][state.compareStat]))) * 100}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                />
                <motion.div
                  className="h-6 rounded-r-full bg-[#0071E3]/60"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(Number(state.players[1][state.compareStat]) / (Number(state.players[0][state.compareStat]) + Number(state.players[1][state.compareStat]))) * 100}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[#FF6B35] font-bold">{Number(state.players[0][state.compareStat]).toFixed(1)}</span>
                <span className="text-[#0071E3] font-bold">{Number(state.players[1][state.compareStat]).toFixed(1)}</span>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button
            type="button"
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#0071E3]/[0.08] border border-[#0071E3]/30 text-sm font-semibold text-[#0071E3] hover:bg-[#0071E3]/[0.12] transition-colors"
          >
            {state.questionNumber >= TOTAL_QUESTIONS ? 'See Results' : 'Next Round'}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Game Mode Selector ───────────────────────────────────────────────────────

function GameModeSelector({ onSelect }: { readonly onSelect: (mode: GameMode) => void }) {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <GlassCard
          className="p-6 sm:p-8"
          tintColor="#FF6B35"
          hoverable
          pressable
          onClick={() => onSelect('guess')}
        >
          <div className="flex flex-col items-center text-center gap-5">
            <div className="flex items-center justify-center h-20 w-20 rounded-3xl bg-[#FF6B35]/[0.08] border border-[#FF6B35]/20">
              <HelpCircle size={36} className="text-[#FF6B35]" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold tracking-[-0.02em] text-[#1D1D1F] font-display">Guess the Player</h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                See a player&apos;s stats with their name hidden. Can you identify them from the numbers alone?
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#86868B]">
              <div className="flex items-center gap-1">
                <Timer size={12} />
                <span>15s per question</span>
              </div>
              <div className="flex items-center gap-1">
                <Target size={12} />
                <span>10 questions</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        <GlassCard
          className="p-6 sm:p-8"
          tintColor="#4DA6FF"
          hoverable
          pressable
          onClick={() => onSelect('compare')}
        >
          <div className="flex flex-col items-center text-center gap-5">
            <div className="flex items-center justify-center h-20 w-20 rounded-3xl bg-[#0071E3]/[0.08] border border-[#0071E3]/20">
              <Scale size={36} className="text-[#0071E3]" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold tracking-[-0.02em] text-[#1D1D1F] font-display">Better Season</h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Two players, one stat. Pick who had the better season. It&apos;s harder than you think!
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#86868B]">
              <div className="flex items-center gap-1">
                <Zap size={12} />
                <span>Quick rounds</span>
              </div>
              <div className="flex items-center gap-1">
                <Target size={12} />
                <span>10 rounds</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PlayModePage() {
  const [gameMode, setGameMode] = useState<GameMode>('select');

  const handleBack = useCallback(() => {
    setGameMode('select');
  }, []);

  return (
    <motion.div
      className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <Gamepad2 size={32} className="text-[#FF6B35]" />
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-[#1D1D1F]">
            Play Mode
          </h1>
        </div>
        <p className="text-sm sm:text-base text-[#86868B]">
          Test your basketball knowledge with interactive trivia games
        </p>
      </motion.div>

      {/* Game Content */}
      <AnimatePresence mode="wait">
        {gameMode === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <GameModeSelector onSelect={setGameMode} />
          </motion.div>
        )}
        {gameMode === 'guess' && (
          <motion.div
            key="guess"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <GuessThePlayerGame onBack={handleBack} />
          </motion.div>
        )}
        {gameMode === 'compare' && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <BetterSeasonGame onBack={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
