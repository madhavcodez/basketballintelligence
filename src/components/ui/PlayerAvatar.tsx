import clsx from 'clsx';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface PlayerAvatarProps {
  readonly name: string;
  readonly size?: AvatarSize;
  readonly teamColor?: string;
  readonly className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'h-8 w-8', text: 'text-xs font-semibold' },
  md: { container: 'h-10 w-10', text: 'text-sm font-semibold' },
  lg: { container: 'h-14 w-14', text: 'text-lg font-bold' },
  xl: { container: 'h-20 w-20', text: 'text-2xl font-extrabold' },
};

// Deterministic gradient palette based on name hash
const gradients = [
  ['#FF6B35', '#FF9F1C'],  // orange-gold
  ['#4DA6FF', '#6366F1'],  // blue-indigo
  ['#34D399', '#06B6D4'],  // green-cyan
  ['#A78BFA', '#EC4899'],  // violet-pink
  ['#F87171', '#FB923C'],  // red-orange
  ['#FBBF24', '#F59E0B'],  // gold-amber
  ['#6366F1', '#8B5CF6'],  // indigo-violet
  ['#14B8A6', '#34D399'],  // teal-green
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function PlayerAvatar({
  name,
  size = 'md',
  teamColor,
  className,
}: PlayerAvatarProps) {
  const styles = sizeMap[size];
  const hash = hashName(name);
  const gradientPair = gradients[hash % gradients.length];

  const bgGradient = teamColor
    ? `linear-gradient(135deg, ${teamColor}, ${teamColor}99)`
    : `linear-gradient(135deg, ${gradientPair[0]}, ${gradientPair[1]})`;

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center rounded-full shrink-0',
        'border border-white/[0.15]',
        'select-none',
        styles.container,
        className,
      )}
      style={{ background: bgGradient }}
      aria-label={name}
    >
      <span className={clsx(styles.text, 'text-white/90 leading-none')}>
        {getInitials(name)}
      </span>
    </div>
  );
}
