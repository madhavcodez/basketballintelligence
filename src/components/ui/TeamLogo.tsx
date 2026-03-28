'use client';

import { useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { teamLogoUrl, NBA_TEAM_IDS } from '@/lib/nba-assets';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface TeamLogoProps {
  readonly teamId?: number | string | null;
  readonly teamAbbr?: string;
  readonly size?: LogoSize;
  readonly className?: string;
}

const sizeMap: Record<LogoSize, { container: string; px: number; text: string }> = {
  sm: { container: 'h-6 w-6', px: 24, text: 'text-[9px] font-bold' },
  md: { container: 'h-8 w-8', px: 32, text: 'text-[10px] font-bold' },
  lg: { container: 'h-12 w-12', px: 48, text: 'text-xs font-bold' },
  xl: { container: 'h-16 w-16', px: 64, text: 'text-sm font-bold' },
};

export default function TeamLogo({
  teamId,
  teamAbbr,
  size = 'md',
  className,
}: TeamLogoProps) {
  const [imgError, setImgError] = useState(false);
  const styles = sizeMap[size];

  // Resolve team ID from abbreviation if not provided directly
  const resolvedId = teamId ?? (teamAbbr ? NBA_TEAM_IDS[teamAbbr.toUpperCase()] : null);
  const hasLogo = resolvedId && !imgError;

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center shrink-0 overflow-hidden',
        styles.container,
        className,
      )}
      aria-label={teamAbbr ?? `Team ${resolvedId}`}
    >
      {hasLogo ? (
        <Image
          src={teamLogoUrl(resolvedId)}
          alt={teamAbbr ?? `Team ${resolvedId}`}
          width={styles.px}
          height={styles.px}
          className="object-contain w-full h-full"
          onError={() => setImgError(true)}
          unoptimized
        />
      ) : (
        <span className={clsx(styles.text, 'text-text-secondary uppercase')}>
          {teamAbbr ?? '?'}
        </span>
      )}
    </div>
  );
}
