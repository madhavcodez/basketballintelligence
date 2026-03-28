'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type SeasonType } from './playoffs-db';

export type { SeasonType } from './playoffs-db';

interface SeasonTypeState {
  readonly seasonType: SeasonType;
  readonly setSeasonType: (type: SeasonType) => void;
  readonly playoffAvailable: boolean;
}

const SeasonTypeContext = createContext<SeasonTypeState | null>(null);

export function SeasonTypeProvider({ children }: { readonly children: ReactNode }) {
  // Always initialize with 'regular' for SSR safety — sync from URL/localStorage in useEffect
  const [seasonType, setSeasonTypeRaw] = useState<SeasonType>('regular');
  const [playoffAvailable, setPlayoffAvailable] = useState(false);

  const setSeasonType = useCallback((type: SeasonType) => {
    setSeasonTypeRaw(type);
    if (typeof window !== 'undefined') {
      localStorage.setItem('seasonType', type);
    }
  }, []);

  // On mount: read from URL first, then localStorage, then default to 'regular'
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlParam = url.searchParams.get('seasonType');
    if (urlParam === 'playoffs' || urlParam === 'combined') {
      setSeasonTypeRaw(urlParam);
      localStorage.setItem('seasonType', urlParam);
      return; // URL takes precedence over localStorage
    }
    // Fall back to localStorage
    const saved = localStorage.getItem('seasonType');
    if (saved === 'playoffs' || saved === 'combined') {
      setSeasonTypeRaw(saved);
    }
  }, []);

  // When seasonType changes, update URL without triggering navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (seasonType === 'regular') {
      url.searchParams.delete('seasonType');
    } else {
      url.searchParams.set('seasonType', seasonType);
    }
    window.history.replaceState({}, '', url.toString());
  }, [seasonType]);

  // Keyboard shortcuts: 1 = Regular, 2 = Playoffs, 3 = Combined
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '1') setSeasonType('regular');
      else if (e.key === '2') setSeasonType('playoffs');
      else if (e.key === '3') setSeasonType('combined');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSeasonType]);

  // Check playoff data availability
  useEffect(() => {
    fetch('/api/v2/data-status')
      .then(r => {
        if (!r.ok) throw new Error(`data-status returned ${r.status}`);
        return r.json() as Promise<unknown>;
      })
      .then((data) => {
        if (typeof data === 'object' && data !== null && 'playoffs' in data) {
          setPlayoffAvailable((data as { playoffs: unknown }).playoffs === true);
        }
      })
      .catch(() => {
        setPlayoffAvailable(false);
      });
  }, []);

  return (
    <SeasonTypeContext value={{ seasonType, setSeasonType, playoffAvailable }}>
      {children}
    </SeasonTypeContext>
  );
}

export function useSeasonType(): SeasonTypeState {
  const ctx = useContext(SeasonTypeContext);
  if (!ctx) throw new Error('useSeasonType must be used within SeasonTypeProvider');
  return ctx;
}
