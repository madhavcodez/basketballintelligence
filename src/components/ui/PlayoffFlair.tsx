'use client';

import { type ReactNode } from 'react';
import { useSeasonType } from '@/lib/season-context';

// CSS class name other components can check for playoff mode
export const PLAYOFF_MODE_CLASS = 'playoff-mode-active';

interface PlayoffFlairProps {
  readonly children: ReactNode;
}

export default function PlayoffFlair({ children }: PlayoffFlairProps) {
  const { seasonType } = useSeasonType();
  const isPlayoffs = seasonType === 'playoffs';

  return (
    <div className={isPlayoffs ? `relative ${PLAYOFF_MODE_CLASS}` : 'relative'}>
      {children}
    </div>
  );
}
