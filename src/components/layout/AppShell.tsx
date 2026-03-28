'use client';

import { type ReactNode, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Menu,
  X,
  FlaskConical,
  Shield,
  Target,
  Flame,
  GitCompareArrows,
  Film as FilmIcon,
  Gamepad2,
  Swords,
  LayoutGrid,
  Bot,
} from 'lucide-react';
import clsx from 'clsx';
import { SeasonTypeProvider, useSeasonType } from '@/lib/season-context';
import SeasonTypeToggle from '@/components/ui/SeasonTypeToggle';

// ─── Nav Link Definitions ──────────────────────────────────────────────────

interface NavLink {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: typeof FlaskConical;
}

const NAV_LINKS: readonly NavLink[] = [
  { id: 'explore', label: 'Player Lab', href: '/explore', icon: FlaskConical },
  { id: 'teams', label: 'Teams', href: '/team/LAL', icon: Shield },
  { id: 'shots', label: 'Shot Lab', href: '/shot-lab', icon: Target },
  { id: 'zones', label: 'Zones', href: '/zones', icon: Flame },
  { id: 'compare', label: 'Compare', href: '/compare', icon: GitCompareArrows },
  { id: 'film', label: 'Film', href: '/film', icon: FilmIcon },
] as const;

const MOBILE_EXTRA_LINKS: readonly NavLink[] = [
  { id: 'matchup', label: 'Head-to-Head', href: '/matchup', icon: Swords },
  { id: 'lineups', label: 'Lineups', href: '/lineup', icon: LayoutGrid },
  { id: 'play', label: 'Play Mode', href: '/play', icon: Gamepad2 },
  { id: 'ask', label: 'Agent', href: '/ask', icon: Bot },
] as const;

function isActiveLink(link: NavLink, pathname: string): boolean {
  if (link.id === 'explore') return pathname.startsWith('/explore') || pathname.startsWith('/player');
  if (link.id === 'teams') return pathname.startsWith('/team');
  return pathname.startsWith(link.href.split('/').slice(0, 2).join('/'));
}

// ─── Season Toggle ─────────────────────────────────────────────────────────

function SeasonToggleInNav() {
  const { seasonType, setSeasonType, playoffAvailable } = useSeasonType();
  return (
    <SeasonTypeToggle
      value={seasonType}
      onChange={setSeasonType}
      playoffAvailable={playoffAvailable}
      compact
    />
  );
}

// ─── Mobile Menu Overlay ───────────────────────────────────────────────────

function MobileMenu({
  open,
  onClose,
  pathname,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly pathname: string;
}) {
  const allLinks = [...NAV_LINKS, ...MOBILE_EXTRA_LINKS];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-white"
        >
          <div className="flex items-center justify-between px-5 h-14">
            <Link
              href="/"
              className="font-display text-lg font-extrabold text-text-primary no-underline"
              onClick={onClose}
            >
              Basketball Intelligence
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-bg-secondary text-text-primary"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="px-5 pt-4">
            <div className="flex flex-col gap-1">
              {allLinks.map((link) => {
                const active = isActiveLink(link, pathname);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl no-underline',
                      'transition-colors duration-150',
                      active
                        ? 'bg-accent-orange/[0.06] text-accent-orange font-semibold'
                        : 'text-text-primary hover:bg-bg-secondary',
                    )}
                  >
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
                    <span className="text-base">{link.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-black/[0.06]">
              <div className="flex items-center justify-between px-4">
                <span className="text-sm text-text-secondary">Season</span>
                <SeasonToggleInNav />
              </div>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Inner Shell ───────────────────────────────────────────────────────────

function AppShellInner({
  children,
  pathname,
}: {
  readonly children: ReactNode;
  readonly pathname: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <div className="relative flex flex-col min-h-dvh">
      {/* Sticky top navbar */}
      <nav
        className={clsx(
          'sticky top-0 z-50',
          'h-14 sm:h-16',
          'bg-white/80 backdrop-blur-xl',
          'border-b border-black/[0.06]',
        )}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Left: Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 no-underline shrink-0"
          >
            <span className="font-display text-lg sm:text-xl font-extrabold text-text-primary tracking-tight">
              BI
            </span>
            <span className="hidden lg:inline font-display text-sm font-bold text-text-secondary">
              Basketball Intelligence
            </span>
          </Link>

          {/* Center: Nav links (desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = isActiveLink(link, pathname);
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className={clsx(
                    'relative px-3 py-1.5 rounded-full text-sm font-medium no-underline',
                    'transition-colors duration-150',
                    active
                      ? 'text-accent-orange'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 bg-accent-orange/[0.06] rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: Season toggle + Search trigger + mobile hamburger */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <SeasonToggleInNav />
            </div>

            <Link
              href="/explore"
              className="flex items-center justify-center h-8 w-8 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors no-underline"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>

            {/* Hamburger (mobile only) */}
            <button
              type="button"
              onClick={openMenu}
              className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full text-text-secondary hover:bg-bg-secondary transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10 flex-1">
        {children}
      </main>

      {/* Mobile menu overlay */}
      <MobileMenu open={mobileMenuOpen} onClose={closeMenu} pathname={pathname} />
    </div>
  );
}

// ─── AppShell ──────────────────────────────────────────────────────────────

interface AppShellProps {
  readonly children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <SeasonTypeProvider>
      <AppShellInner pathname={pathname}>{children}</AppShellInner>
    </SeasonTypeProvider>
  );
}
