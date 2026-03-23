'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Compass,
  Users,
  GitCompareArrows,
  Target,
  Shield,
  BookOpen,
  Gamepad2,
  LayoutGrid,
  Bot,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Tab Definitions ─────────────────────────────────────────────────────────

interface TabDef {
  readonly id: string;
  readonly label: string;
  readonly icon: typeof Compass;
  readonly href: string;
}

const TABS: readonly TabDef[] = [
  { id: 'explore', label: 'Explore', icon: Compass, href: '/' },
  { id: 'players', label: 'Players', icon: Users, href: '/player/LeBron James' },
  { id: 'compare', label: 'Compare', icon: GitCompareArrows, href: '/compare' },
  { id: 'shots', label: 'Shots', icon: Target, href: '/shot-lab' },
  { id: 'teams', label: 'Teams', icon: Shield, href: '/team/LAL' },
  { id: 'stories', label: 'Stories', icon: BookOpen, href: '/stories' },
  { id: 'play', label: 'Play', icon: Gamepad2, href: '/play' },
  { id: 'lineups', label: 'Lineups', icon: LayoutGrid, href: '/lineup' },
  { id: 'ask', label: 'Agent', icon: Bot, href: '/ask' },
] as const;

function isActiveTab(tab: TabDef, pathname: string): boolean {
  if (tab.id === 'explore') return pathname === '/' || pathname.startsWith('/explore');
  return pathname.startsWith(tab.href.split('/').slice(0, 2).join('/'));
}

// ─── AppShell ────────────────────────────────────────────────────────────────

interface AppShellProps {
  readonly children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative flex flex-col min-h-dvh">
      <main className="relative z-10 flex-1 overflow-y-auto pb-nav">
        {children}
      </main>

      <nav
        className={clsx(
          'fixed bottom-0 inset-x-0 z-50',
          'px-3 pb-[env(safe-area-inset-bottom,8px)] pt-1',
          'sm:px-4 sm:pb-[env(safe-area-inset-bottom,12px)]',
        )}
      >
        <div
          className={clsx(
            'mx-auto max-w-2xl',
            'flex items-center justify-around',
            'rounded-2xl sm:rounded-[20px]',
            'bg-[#12121e]/80 backdrop-blur-xl',
            'border border-white/[0.12]',
            'shadow-[0_-4px_30px_rgba(0,0,0,0.3),0_0_20px_rgba(255,107,53,0.05)]',
            'px-1 py-1 sm:px-2 sm:py-1.5',
          )}
        >
          {TABS.map((tab) => {
            const active = isActiveTab(tab, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={clsx(
                  'relative flex flex-col items-center justify-center gap-0.5 px-2 py-1.5',
                  'transition-colors duration-200 outline-none no-underline',
                  'sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:rounded-xl',
                  active
                    ? 'text-[#FF6B35]'
                    : 'text-white/[0.44] hover:text-white/[0.70]',
                )}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-[#FF6B35]/[0.12] hidden sm:block shadow-[0_0_12px_rgba(255,107,53,0.15)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF6B35] sm:hidden" />
                )}
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="relative z-10 shrink-0"
                />
                <span
                  className={clsx(
                    'relative z-10 text-[10px] leading-tight sm:text-xs sm:font-medium',
                    active ? 'font-semibold' : 'font-normal',
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
