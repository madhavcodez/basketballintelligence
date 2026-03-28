import clsx from 'clsx';

interface SkeletonLoaderProps {
  readonly width?: string | number;
  readonly height?: string | number;
  readonly rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  readonly count?: number;
  readonly className?: string;
}

const roundedMap = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-[20px]',
  full: 'rounded-full',
} as const;

export default function SkeletonLoader({
  width,
  height = 20,
  rounded = 'md',
  count = 1,
  className,
}: SkeletonLoaderProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={clsx(
            'shimmer',
            'bg-[#F5F5F7]',
            'animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-black/[0.03] to-transparent',
            roundedMap[rounded],
            className,
          )}
          style={style}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
