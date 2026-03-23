'use client';

import { type ChangeEvent, type FormEvent, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly onSubmit?: (value: string) => void;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search players, teams, stats...',
  onSubmit,
}: SearchBarProps) {
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

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (value.trim()) {
        onSubmit?.(value.trim());
      }
    },
    [value, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={clsx(
          'group relative flex items-center',
          'rounded-full',
          'bg-glass-frosted backdrop-blur-xl',
          'border border-glass-border',
          'transition-all duration-200',
          'focus-within:border-accent-orange/40',
          'focus-within:shadow-[0_0_16px_rgba(255,107,53,0.12)]',
        )}
      >
        {/* Search icon */}
        <Search
          size={16}
          className="ml-4 shrink-0 text-chrome-dim transition-colors group-focus-within:text-accent-orange"
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
            'px-3 py-3 sm:py-3.5',
            'text-sm text-chrome-light placeholder:text-chrome-dim',
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
              'bg-chrome-faint/40 text-chrome-medium',
              'transition-colors hover:bg-chrome-faint hover:text-chrome-light',
            )}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </form>
  );
}
