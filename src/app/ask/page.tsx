'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Send,
  Sparkles,
  User,
  Loader2,
  Table2,
  BarChart3,
  GitCompareArrows,
  AlertTriangle,
  ChevronRight,
  Zap,
  X,
  Trophy,
  Shield,
  Activity,
  FlaskConical,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgenticResponse {
  readonly intent: string;
  readonly title: string;
  readonly explanation: string;
  readonly data: readonly Record<string, unknown>[] | null;
  readonly columns: readonly string[];
  readonly chartType: string;
  readonly followUps: readonly string[];
  readonly rowCount?: number;
  readonly error?: string;
}

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly response?: AgenticResponse;
  readonly timestamp: number;
}

// ─── Intent / Category Config ────────────────────────────────────────────────

type QueryCategory = 'all' | 'leaders' | 'players' | 'teams' | 'comparisons' | 'advanced';

const CATEGORY_CONFIG: Record<QueryCategory, { label: string; icon: typeof Sparkles; color: string }> = {
  all:         { label: 'All',       icon: Sparkles,         color: 'text-[#6E6E73]' },
  leaders:     { label: 'Leaders',   icon: Trophy,           color: 'text-[#F59E0B]' },
  players:     { label: 'Players',   icon: Activity,         color: 'text-[#0071E3]' },
  teams:       { label: 'Teams',     icon: Shield,           color: 'text-[#22C55E]' },
  comparisons: { label: 'Compare',   icon: GitCompareArrows, color: 'text-[#6E6E73]' },
  advanced:    { label: 'Advanced',  icon: FlaskConical,     color: 'text-[#FF6B35]' },
};

const INTENT_LABELS: Record<string, string> = {
  player_stats:  'Player Stats',
  comparison:    'Comparison',
  leaders:       'League Leaders',
  team_stats:    'Team Stats',
  shot_analysis: 'Shot Analysis',
  trivia:        'Trivia',
  general:       'General',
  unsupported:   'Unsupported',
};

const INTENT_CATEGORY_MAP: Record<string, QueryCategory> = {
  player_stats:  'players',
  comparison:    'comparisons',
  leaders:       'leaders',
  team_stats:    'teams',
  shot_analysis: 'advanced',
  trivia:        'advanced',
  general:       'all',
};

interface QuickAction {
  readonly label: string;
  readonly query: string;
  readonly icon: typeof Sparkles;
  readonly category: QueryCategory;
  readonly example?: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: 'Scoring leaders',      query: 'Who are the top 10 scorers this season?',                   icon: Trophy,           category: 'leaders',     example: 'PPG leaders' },
  { label: '3PT shooting leaders', query: 'Best 3-point shooters with at least 50 games this season',  icon: BarChart3,         category: 'leaders',     example: '3P% ≥ 34%' },
  { label: 'Assist leaders',       query: 'Top 10 assist leaders this season with 50+ games',          icon: Zap,              category: 'leaders',     example: 'APG leaders' },
  { label: 'Compare two players',  query: 'Compare LeBron James vs Stephen Curry career averages',     icon: GitCompareArrows, category: 'comparisons', example: 'Side-by-side' },
  { label: 'Team roster stats',    query: 'Show the Lakers roster with their stats this season',       icon: Shield,           category: 'teams',       example: 'Full roster' },
  { label: 'Player career',        query: 'Show LeBron James career stats by season',                 icon: Activity,         category: 'players',     example: 'Per-season view' },
  { label: 'MVP winners',          query: 'Show MVP award winners in the last 10 seasons',            icon: Sparkles,         category: 'advanced',    example: 'Award history' },
  { label: 'Best defenders',       query: 'Top 10 defenders by combined steals and blocks this season', icon: FlaskConical,   category: 'advanced',    example: 'STL + BLK' },
];

// ─── Animation Variants ────────────────────────────────────────────────────

const messageVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
};

// ─── Data Table ──────────────────────────────────────────────────────────────

function DataTable({
  data,
  columns,
}: {
  readonly data: readonly Record<string, unknown>[];
  readonly columns: readonly string[];
}) {
  if (!data || data.length === 0) return null;

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toFixed(1);
    }
    return String(val);
  };

  const formatHeader = (col: string): string =>
    col.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  return (
    <div className="overflow-x-auto -mx-4 px-4 mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06]">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left text-[10px] uppercase tracking-wider font-semibold text-[#86868B] py-2 px-2.5 first:pl-0 whitespace-nowrap"
              >
                {formatHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 25).map((row, i) => (
            <tr
              key={i}
              className={clsx('border-b border-black/[0.06] last:border-0 hover:bg-[#F5F5F7] transition-colors', i % 2 === 1 && 'bg-[#F5F5F7]')}
            >
              {columns.map((col, j) => (
                <td
                  key={col}
                  className={clsx(
                    'py-2 px-2.5 first:pl-0 whitespace-nowrap',
                    j === 0 ? 'text-[#86868B] font-mono text-xs' : 'text-[#1D1D1F]',
                    j === 1 && 'font-medium',
                  )}
                >
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 25 && (
        <p className="text-xs text-[#86868B] mt-2 text-center">Showing 25 of {data.length} results</p>
      )}
    </div>
  );
}

// ─── Intent Badge ─────────────────────────────────────────────────────────────

function IntentBadge({ intent }: { readonly intent: string }) {
  const category = INTENT_CATEGORY_MAP[intent] ?? 'all';
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  const label = INTENT_LABELS[intent] ?? intent;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ─── Query Detail Strip ───────────────────────────────────────────────────────

function QueryDetails({ intent, rowCount }: { readonly intent: string; readonly rowCount?: number }) {
  const notes: string[] = [];

  if (intent === 'leaders' || intent === 'player_stats') {
    notes.push('Season: 2023-24');
    notes.push('Min games: 50+');
  } else if (intent === 'comparison') {
    notes.push('Career averages');
    notes.push('Regular season');
  } else if (intent === 'team_stats') {
    notes.push('Current season');
  } else if (intent === 'shot_analysis') {
    notes.push('2023-24 shot log');
  } else {
    notes.push('Regular season data');
  }

  if (rowCount != null && rowCount > 0) {
    notes.push(`${rowCount} result${rowCount !== 1 ? 's' : ''}`);
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-black/[0.06]/40">
      {notes.map((note) => (
        <span key={note} className="text-[10px] text-[#86868B] flex items-center gap-1">
          <Info size={9} className="shrink-0" />
          {note}
        </span>
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onFollowUp,
}: {
  readonly message: ChatMessage;
  readonly onFollowUp: (text: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div variants={messageVariants} initial="hidden" animate="visible" className="flex justify-end">
        <div className="flex items-start gap-2.5 max-w-[85%]">
          <div
            className={clsx(
              'px-4 py-3 rounded-2xl rounded-tr-md',
              'bg-[#F5F5F7] border border-black/[0.06]',
              'text-sm text-[#1D1D1F]',
            )}
          >
            {message.content}
          </div>
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#F5F5F7] shrink-0">
            <User size={14} className="text-[#6E6E73]" />
          </div>
        </div>
      </motion.div>
    );
  }

  const resp = message.response;

  return (
    <motion.div variants={messageVariants} initial="hidden" animate="visible" className="flex justify-start">
      <div className="flex items-start gap-2.5 max-w-[90%] w-full">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#FF6B35]/10 shrink-0 mt-0.5">
          <Database size={14} className="text-[#FF6B35]" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {resp?.error ? (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[#F59E0B]" />
                <span className="text-sm font-semibold text-[#1D1D1F]">Query Error</span>
              </div>
              <p className="text-sm text-[#86868B]">{resp.error}</p>
            </GlassCard>
          ) : resp ? (
            <GlassCard className="p-4 overflow-hidden">
              {/* Intent + title */}
              <div className="flex items-start gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <IntentBadge intent={resp.intent} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1D1D1F] leading-snug">{resp.title}</h3>
                </div>
                {resp.chartType === 'bar' && <BarChart3 size={14} className="text-[#0071E3] shrink-0 mt-0.5" />}
                {resp.chartType === 'comparison' && <GitCompareArrows size={14} className="text-[#6E6E73] shrink-0 mt-0.5" />}
                {resp.chartType === 'table' && <Table2 size={14} className="text-[#22C55E] shrink-0 mt-0.5" />}
              </div>

              {/* Explanation */}
              <p className="text-sm text-[#6E6E73] leading-relaxed mb-1">{resp.explanation}</p>

              {/* Data table */}
              {resp.data && resp.data.length > 0 && resp.columns.length > 0 && (
                <DataTable data={resp.data} columns={resp.columns} />
              )}

              {/* Query details */}
              {resp.intent !== 'unsupported' && resp.intent !== 'error' && (
                <QueryDetails intent={resp.intent} rowCount={resp.rowCount} />
              )}

              {/* Follow-ups */}
              {resp.followUps && resp.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/[0.06]/50">
                  {resp.followUps.map((fu) => (
                    <button
                      key={fu}
                      type="button"
                      onClick={() => onFollowUp(fu)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-[11px]',
                        'bg-white border border-black/[0.12]',
                        'text-[#6E6E73] hover:bg-[#F5F5F7] hover:border-black/[0.12]',
                        'transition-all duration-200 max-w-[260px]',
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <ChevronRight size={10} className="shrink-0" />
                        <span className="truncate">{fu}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          ) : (
            <div className="text-sm text-[#86868B]">{message.content}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Category Pill ────────────────────────────────────────────────────────────

function CategoryPill({
  category,
  active,
  onClick,
}: {
  readonly category: QueryCategory;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
        'border transition-all duration-200',
        active
          ? 'bg-[#F5F5F7] border-black/[0.12] text-[#1D1D1F]'
          : 'bg-transparent border-black/[0.06] text-[#86868B] hover:text-[#6E6E73] hover:border-black/[0.12]',
      )}
    >
      <Icon size={11} className={active ? cfg.color : undefined} />
      {cfg.label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AskTheDataPage() {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<QueryCategory>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.role === 'user' ? m.content : (m.response?.explanation ?? m.content),
      }));

      const res = await fetch('/api/agentic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, history }),
      });

      const data: AgenticResponse = await res.json();

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.explanation ?? data.error ?? 'No response',
        response: data,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        response: {
          intent: 'error',
          title: 'Connection Error',
          explanation: 'Failed to reach the data service. Check your connection and try again.',
          data: null,
          columns: [],
          chartType: 'none',
          followUps: [],
          error: 'Network error',
        },
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    inputRef.current?.focus();
  }, []);

  const isEmpty = messages.length === 0;

  const filteredActions =
    activeCategory === 'all'
      ? QUICK_ACTIONS
      : QUICK_ACTIONS.filter((a) => a.category === activeCategory);

  const categories: readonly QueryCategory[] = ['all', 'leaders', 'players', 'teams', 'comparisons', 'advanced'];

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-[#FF6B35]/10 border border-black/[0.06]">
                <Database size={18} className="text-[#FF6B35]" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-lg sm:text-xl text-[#1D1D1F] flex items-center gap-2">
                  Ask the Data
                  <Badge variant="warning" className="text-[9px]">Beta</Badge>
                </h1>
                <p className="text-[11px] text-[#86868B]">
                  Structured NBA queries &middot; Powered by live database
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#86868B] hover:text-[#1D1D1F] hover:bg-white transition-colors"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages / Empty State ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">

          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center pt-6 sm:pt-10"
              >
                {/* Hero icon */}
                <div
                  className="flex items-center justify-center rounded-2xl mb-5 bg-[#FF6B35]/10 border border-black/[0.06]"
                  style={{ height: 72, width: 72 }}
                >
                  <Database size={28} className="text-[#FF6B35]" />
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-[#1D1D1F] font-display mb-1.5 text-center">
                  Ask the Data
                </h2>
                <p className="text-sm text-[#86868B] max-w-sm mx-auto text-center leading-relaxed mb-3">
                  Natural language queries against live NBA stats. Select a category or type your own question.
                </p>

                {/* Supported query notice */}
                <div className="flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full bg-[#0071E3]/[0.06] border border-[#0071E3]/15">
                  <Info size={11} className="text-[#0071E3]" />
                  <span className="text-[11px] text-[#0071E3]/80 font-medium">
                    Supports: leaders · player stats · team data · comparisons · advanced
                  </span>
                </div>

                {/* Category filter */}
                <div className="flex flex-wrap justify-center gap-2 mb-4 w-full max-w-lg">
                  {categories.map((cat) => (
                    <CategoryPill
                      key={cat}
                      category={cat}
                      active={activeCategory === cat}
                      onClick={() => setActiveCategory(cat)}
                    />
                  ))}
                </div>

                {/* Filtered quick actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  <AnimatePresence mode="popLayout">
                    {filteredActions.map((action) => {
                      const Icon = action.icon;
                      const catCfg = CATEGORY_CONFIG[action.category];
                      return (
                        <motion.button
                          key={action.label}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          type="button"
                          onClick={() => sendMessage(action.query)}
                          className={clsx(
                            'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left',
                            'bg-white border border-black/[0.12]',
                            'hover:bg-[#F5F5F7]',
                            'transition-all duration-200 group',
                          )}
                        >
                          <Icon size={14} className={clsx(catCfg.color, 'shrink-0')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#6E6E73] group-hover:text-[#1D1D1F] transition-colors">
                              {action.label}
                            </p>
                            {action.example && (
                              <p className="text-[10px] text-[#86868B]">{action.example}</p>
                            )}
                          </div>
                          <ChevronRight size={12} className="ml-auto text-[#86868B]/50 group-hover:text-[#86868B] transition-colors shrink-0" />
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onFollowUp={sendMessage} />
          ))}

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#FF6B35]/10 shrink-0">
                  <Database size={14} className="text-[#FF6B35]" />
                </div>
                <GlassCard className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-[#FF6B35] animate-spin" />
                    <span className="text-sm text-[#86868B]">Querying database...</span>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="shrink-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="w-full"
          >
            <div
              className={clsx(
                'group relative flex items-end gap-2 rounded-2xl',
                'bg-white border border-black/[0.06]',
                'transition-all duration-200',
                'focus-within:border-[#FF6B35]/40',
                'focus-within:shadow-[0_0_20px_rgba(255,107,53,0.1)]',
                'px-4 py-3',
              )}
            >
              <textarea
                ref={inputRef}
                aria-label="Ask a basketball question"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about players, teams, leaders, comparisons..."
                rows={1}
                className={clsx(
                  'flex-1 bg-transparent resize-none outline-none',
                  'text-sm text-[#1D1D1F] placeholder:text-[#86868B]',
                  'max-h-[120px]',
                )}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send query"
                className={clsx(
                  'flex items-center justify-center h-8 w-8 rounded-xl shrink-0 transition-all duration-200',
                  input.trim() && !loading
                    ? 'bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80'
                    : 'bg-white text-[#86868B] cursor-not-allowed',
                )}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-[#86868B]/60 mt-1.5 text-center">
              Read-only queries &middot; Regular season data &middot;{' '}
              <Link href="/player/LeBron James" className="inline-flex items-center gap-1 hover:text-[#86868B] transition-colors">
                <PlayerAvatar name="LeBron James" size="sm" />
                Try Player Lab
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
