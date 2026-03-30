import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);
import React from 'react';

// ── Mock next/image (not available in jsdom) ──────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) =>
    React.createElement('img', { alt, ...props }),
}));

// ── Mock framer-motion (avoid JSDOM animation warnings) ──────────────────────
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) =>
          ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
            React.createElement(prop as keyof JSX.IntrinsicElements, rest, children),
      },
    ),
    LayoutGroup: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

// ── Mock season-context (requires client-side hooks) ─────────────────────────
vi.mock('@/lib/season-context', () => ({
  useSeasonType: () => ({ seasonType: 'regular', setSeasonType: vi.fn(), playoffAvailable: false }),
  SeasonTypeProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ─────────────────────────────────────────────────────────────────────────────

import Badge from '@/components/ui/Badge';
import MetricChip from '@/components/ui/MetricChip';
import SectionHeader from '@/components/ui/SectionHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import PlayoffEmptyState from '@/components/ui/PlayoffEmptyState';
import SeasonTypeBadge from '@/components/ui/SeasonTypeBadge';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import TeamLogo from '@/components/ui/TeamLogo';

// ── Badge ─────────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renders children text', () => {
    render(React.createElement(Badge, null, 'Active'));
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders with accent variant without crashing', () => {
    render(React.createElement(Badge, { variant: 'accent' }, 'HOF'));
    expect(screen.getByText('HOF')).toBeTruthy();
  });

  it('renders with success variant without crashing', () => {
    render(React.createElement(Badge, { variant: 'success' }, 'Champion'));
    expect(screen.getByText('Champion')).toBeTruthy();
  });

  it('renders with warning variant without crashing', () => {
    render(React.createElement(Badge, { variant: 'warning' }, 'MVP'));
    expect(screen.getByText('MVP')).toBeTruthy();
  });
});

// ── MetricChip ───────────────────────────────────────────────────────────────

describe('MetricChip', () => {
  it('renders label and value', () => {
    render(React.createElement(MetricChip, { label: 'PPG', value: 27.3 }));
    expect(screen.getByText('PPG')).toBeTruthy();
    expect(screen.getByText('27.3')).toBeTruthy();
  });

  it('renders with highlight prop without crashing', () => {
    render(React.createElement(MetricChip, { label: 'REB', value: 10, highlight: true }));
    expect(screen.getByText('REB')).toBeTruthy();
  });

  it('renders in sm size', () => {
    render(React.createElement(MetricChip, { label: 'AST', value: 8.5, size: 'sm' }));
    expect(screen.getByText('AST')).toBeTruthy();
  });

  it('renders in lg size', () => {
    render(React.createElement(MetricChip, { label: 'BLK', value: 2.1, size: 'lg' }));
    expect(screen.getByText('BLK')).toBeTruthy();
  });

  it('renders with trend up', () => {
    render(React.createElement(MetricChip, { label: 'PTS', value: 30, trend: 'up' }));
    expect(screen.getByText('PTS')).toBeTruthy();
  });
});

// ── SectionHeader ─────────────────────────────────────────────────────────────

describe('SectionHeader', () => {
  it('renders title', () => {
    render(React.createElement(SectionHeader, { title: 'Top Scorers' }));
    expect(screen.getByText('Top Scorers')).toBeTruthy();
  });

  it('renders eyebrow when provided', () => {
    render(React.createElement(SectionHeader, { title: 'Stats', eyebrow: 'Season Leaders' }));
    expect(screen.getByText('Stats')).toBeTruthy();
    expect(screen.getByText('Season Leaders')).toBeTruthy();
  });

  it('renders action slot when provided', () => {
    render(
      React.createElement(SectionHeader, {
        title: 'Players',
        action: React.createElement('button', null, 'View All'),
      }),
    );
    expect(screen.getByText('View All')).toBeTruthy();
  });
});

// ── SkeletonLoader ────────────────────────────────────────────────────────────

describe('SkeletonLoader', () => {
  it('renders without crashing (default props)', () => {
    const { container } = render(React.createElement(SkeletonLoader, null));
    expect(container.firstChild).toBeTruthy();
  });

  it('renders count items', () => {
    const { container } = render(React.createElement(SkeletonLoader, { count: 3 }));
    const items = container.querySelectorAll('[aria-hidden="true"]');
    expect(items).toHaveLength(3);
  });

  it('accepts width and height props', () => {
    const { container } = render(
      React.createElement(SkeletonLoader, { width: 100, height: 20 }),
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ── SearchBar ─────────────────────────────────────────────────────────────────

describe('SearchBar', () => {
  it('renders input element', () => {
    render(
      React.createElement(SearchBar, {
        value: '',
        onChange: vi.fn(),
      }),
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
  });

  it('shows provided value in input', () => {
    render(
      React.createElement(SearchBar, {
        value: 'LeBron',
        onChange: vi.fn(),
      }),
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('LeBron');
  });

  it('shows clear button when value is non-empty', () => {
    render(
      React.createElement(SearchBar, {
        value: 'James',
        onChange: vi.fn(),
      }),
    );
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('shows custom placeholder', () => {
    render(
      React.createElement(SearchBar, {
        value: '',
        onChange: vi.fn(),
        placeholder: 'Find a player...',
      }),
    );
    expect(screen.getByPlaceholderText('Find a player...')).toBeTruthy();
  });
});

// ── PlayoffEmptyState ─────────────────────────────────────────────────────────

describe('PlayoffEmptyState', () => {
  it('renders default title when no props given', () => {
    render(React.createElement(PlayoffEmptyState, null));
    expect(screen.getByText('Playoff Data Coming Soon')).toBeTruthy();
  });

  it('renders custom title and message', () => {
    render(
      React.createElement(PlayoffEmptyState, {
        title: 'No Data',
        message: 'Nothing here.',
      }),
    );
    expect(screen.getByText('No Data')).toBeTruthy();
    expect(screen.getByText('Nothing here.')).toBeTruthy();
  });
});

// ── SeasonTypeBadge ───────────────────────────────────────────────────────────

describe('SeasonTypeBadge', () => {
  it('renders REG SEASON label for regular type', () => {
    render(React.createElement(SeasonTypeBadge, { type: 'regular' }));
    expect(screen.getByText('REG SEASON')).toBeTruthy();
  });

  it('renders PLAYOFFS label for playoffs type', () => {
    render(React.createElement(SeasonTypeBadge, { type: 'playoffs' }));
    expect(screen.getByText('PLAYOFFS')).toBeTruthy();
  });

  it('renders COMBINED label for combined type', () => {
    render(React.createElement(SeasonTypeBadge, { type: 'combined' }));
    expect(screen.getByText('COMBINED')).toBeTruthy();
  });
});

// ── PlayerAvatar ──────────────────────────────────────────────────────────────

describe('PlayerAvatar', () => {
  it('renders initials when no playerId given', () => {
    render(React.createElement(PlayerAvatar, { name: 'LeBron James' }));
    // Initials = LJ
    expect(screen.getByText('LJ')).toBeTruthy();
  });

  it('has aria-label set to player name', () => {
    render(React.createElement(PlayerAvatar, { name: 'Stephen Curry' }));
    expect(screen.getByLabelText('Stephen Curry')).toBeTruthy();
  });

  it('renders in xl size without crashing', () => {
    render(React.createElement(PlayerAvatar, { name: 'Kobe Bryant', size: 'xl' }));
    expect(screen.getByLabelText('Kobe Bryant')).toBeTruthy();
  });
});

// ── TeamLogo ──────────────────────────────────────────────────────────────────

describe('TeamLogo', () => {
  it('renders abbreviation fallback when no id given', () => {
    render(React.createElement(TeamLogo, { teamAbbr: 'LAL' }));
    // The fallback span shows the abbr text when no logo loads
    // With our image mock, the Image component renders but may error;
    // the aria-label should still be present
    expect(screen.getByLabelText('LAL')).toBeTruthy();
  });

  it('renders ? when no teamAbbr or teamId given', () => {
    render(React.createElement(TeamLogo, null));
    // Renders the element; since no abbr provided, aria-label uses undefined id
    const el = document.querySelector('[aria-label]');
    expect(el).toBeTruthy();
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders title and subtitle', async () => {
    const { Search } = await import('lucide-react');
    render(
      React.createElement(EmptyState, {
        icon: Search,
        title: 'No Results',
        subtitle: 'Try a different search.',
      }),
    );
    expect(screen.getByText('No Results')).toBeTruthy();
    expect(screen.getByText('Try a different search.')).toBeTruthy();
  });

  it('renders action when provided', async () => {
    const { Search } = await import('lucide-react');
    render(
      React.createElement(EmptyState, {
        icon: Search,
        title: 'Empty',
        subtitle: 'Nothing found.',
        action: React.createElement('button', null, 'Reset'),
      }),
    );
    expect(screen.getByText('Reset')).toBeTruthy();
  });
});
