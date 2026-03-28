'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import { animation } from '@/lib/design-tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  readonly id: number;
  readonly name: string;
  readonly position: string;
  readonly active: number;
}

interface MatchupSearchProps {
  readonly onChange: (player1: string | null, player2: string | null) => void;
  readonly initialPlayer1?: string;
  readonly initialPlayer2?: string;
}

// ── Single Player Input ──────────────────────────────────────────────────────

interface PlayerInputProps {
  readonly label: string;
  readonly accentColor: string;
  readonly focusBorderClass: string;
  readonly selectedName: string | null;
  readonly onSelect: (name: string) => void;
  readonly onClear: () => void;
}

function PlayerInput({
  label,
  accentColor,
  focusBorderClass,
  selectedName,
  onSelect,
  onClear,
}: PlayerInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchResults = useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(value)}&limit=6`,
        );
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) {
            setResults(json);
          }
        }
      } catch {
        /* network error — dropdown stays empty */
      }
    }, 300);
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      fetchResults(value);
    },
    [fetchResults],
  );

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(name);
      setQuery('');
      setResults([]);
      setIsFocused(false);
    },
    [onSelect],
  );

  const handleClear = useCallback(() => {
    onClear();
    setQuery('');
    setResults([]);
  }, [onClear]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <label className="text-[10px] uppercase tracking-wider text-[#86868B] font-medium mb-1.5 block">
        {label}
      </label>

      {selectedName ? (
        <div
          className={clsx(
            'flex items-center gap-2 rounded-2xl px-4 py-3',
            'bg-white border border-black/[0.06]',
          )}
        >
          <PlayerAvatar name={selectedName} size="sm" />
          <span
            className="text-sm font-bold truncate"
            style={{ color: accentColor }}
          >
            {selectedName}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto shrink-0 p-1 rounded-full hover:bg-black/[0.06] transition-colors"
            aria-label={`Clear ${label}`}
          >
            <X size={14} className="text-[#86868B]" />
          </button>
        </div>
      ) : (
        <div
          className={clsx(
            'group relative flex items-center rounded-2xl',
            'bg-white border border-black/[0.06]',
            'transition-all duration-200',
            isFocused && focusBorderClass,
            isFocused && 'shadow-[0_0_20px_rgba(0,0,0,0.04)]',
          )}
        >
          <Search size={14} className="ml-3 shrink-0 text-[#86868B]" />
          <input
            type="text"
            aria-label={`Search ${label}`}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search player..."
            className="flex-1 bg-transparent px-2 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B] outline-none"
          />
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isFocused && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={animation.spring.gentle}
            className="absolute z-30 mt-1.5 w-full rounded-xl bg-white border border-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.name)}
                className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-[#F5F5F7] transition-colors text-left"
              >
                <PlayerAvatar name={r.name} size="sm" />
                <span className="text-sm text-[#1D1D1F] truncate">
                  {r.name}
                </span>
                <Badge variant="default" className="ml-auto shrink-0">
                  {r.position}
                </Badge>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MatchupSearch({
  onChange,
  initialPlayer1,
  initialPlayer2,
}: MatchupSearchProps) {
  const [player1, setPlayer1] = useState<string | null>(
    initialPlayer1 ?? null,
  );
  const [player2, setPlayer2] = useState<string | null>(
    initialPlayer2 ?? null,
  );

  const handleP1Select = useCallback(
    (name: string) => {
      setPlayer1(name);
      onChange(name, player2);
    },
    [onChange, player2],
  );

  const handleP2Select = useCallback(
    (name: string) => {
      setPlayer2(name);
      onChange(player1, name);
    },
    [onChange, player1],
  );

  const handleP1Clear = useCallback(() => {
    setPlayer1(null);
    onChange(null, player2);
  }, [onChange, player2]);

  const handleP2Clear = useCallback(() => {
    setPlayer2(null);
    onChange(player1, null);
  }, [onChange, player1]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
      <PlayerInput
        label="Player 1"
        accentColor="#FF6B35"
        focusBorderClass="border-accent-orange/40"
        selectedName={player1}
        onSelect={handleP1Select}
        onClear={handleP1Clear}
      />

      <div className="flex items-center justify-center shrink-0 sm:pb-1">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F5F5F7] border border-black/[0.06]">
          <span className="text-xs font-extrabold text-[#6E6E73] tracking-wide">
            VS
          </span>
        </div>
      </div>

      <PlayerInput
        label="Player 2"
        accentColor="#4DA6FF"
        focusBorderClass="border-accent-blue/40"
        selectedName={player2}
        onSelect={handleP2Select}
        onClear={handleP2Clear}
      />
    </div>
  );
}
