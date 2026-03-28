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
          'bg-white',
          'border border-black/[0.12]',
          'transition-all duration-200',
          'focus-within:border-accent-blue/40',
          'focus-within:shadow-[0_0_0_3px_rgba(0,113,227,0.1)]',
        )}
      >
        <Search
          size={16}
          className="ml-4 shrink-0 text-text-tertiary transition-colors group-focus-within:text-accent-blue"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={clsx(
            'flex-1 bg-transparent',
            'px-3 py-3 sm:py-3.5',
            'text-sm text-text-primary placeholder:text-text-tertiary',
            'outline-none',
          )}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className={clsx(
              'mr-3 flex items-center justify-center',
              'h-6 w-6 rounded-full',
              'bg-black/[0.06] text-text-secondary',
              'transition-colors hover:bg-black/[0.12] hover:text-text-primary',
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
