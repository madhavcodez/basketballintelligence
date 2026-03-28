'use client';

import { type ChangeEvent, useCallback, useRef } from 'react';
import { Search, X, Film } from 'lucide-react';
import clsx from 'clsx';

interface FilmSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}

export default function FilmSearch({
  value,
  onChange,
  placeholder = 'Search clips, players, plays...',
  className,
}: FilmSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div
      className={clsx(
        'group relative flex items-center',
        'rounded-xl',
        'bg-[#F5F5F7]',
        'border border-black/[0.06]',
        'transition-all duration-200',
        'focus-within:border-[#0071E3]/40',
        'focus-within:shadow-[0_0_20px_rgba(77,166,255,0.12)]',
        className,
      )}
    >
      {/* Film icon accent */}
      <Film
        size={14}
        className="ml-4 shrink-0 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]/60"
      />

      {/* Search icon */}
      <Search
        size={16}
        className="ml-1.5 shrink-0 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]"
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={clsx(
          'flex-1 bg-transparent',
          'px-3 py-3',
          'text-sm text-[#1D1D1F] placeholder:text-[#86868B]',
          'outline-none',
        )}
      />

      {/* Clear button */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className={clsx(
            'mr-3 flex items-center justify-center',
            'h-6 w-6 rounded-full',
            'bg-[#86868B]/40 text-[#6E6E73]',
            'transition-colors hover:bg-[#86868B] hover:text-[#1D1D1F]',
          )}
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
