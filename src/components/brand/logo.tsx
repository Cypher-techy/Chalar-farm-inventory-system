import Image from 'next/image';

/**
 * Chalar Farms brand mark — rust crescent "C" cradling a glowing leaf.
 *
 * Assets are generated from the supplied artwork by scripts/build-brand-assets.cjs:
 *   compact → transparent, halo trimmed      (dark surfaces: header, sidebar, footer)
 *   glow    → transparent, full rust halo    (large brand moments on dark surfaces)
 *   tile    → original near-black background (light surfaces, favicon)
 */
const SOURCES = {
  compact: '/brand/chalar-mark.png',
  glow: '/brand/chalar-mark-glow.png',
  tile: '/brand/chalar-mark-tile.png',
} as const;

export type LogoVariant = keyof typeof SOURCES;

export function LogoMark({
  variant = 'compact',
  size = 40,
  className = '',
  priority = false,
  decorative = false,
}: {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  priority?: boolean;
  /** Set when the mark sits next to the "Chalar Farms" wordmark, to avoid double announcements. */
  decorative?: boolean;
}) {
  return (
    <Image
      src={SOURCES[variant]}
      alt={decorative ? '' : 'Chalar Farms logo'}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      priority={priority}
      sizes={`${size}px`}
      className={[
        'shrink-0 select-none',
        variant === 'tile' ? 'rounded-[22%] shadow-sm ring-1 ring-black/10' : '',
        className,
      ].join(' ')}
      draggable={false}
    />
  );
}

/** Mark + two-line wordmark lockup. `tone` sets the text colours for the surface it sits on. */
export function LogoLockup({
  tone = 'dark',
  size = 40,
  subtitle = 'Growers & Exporters of Fresh Herbs',
  className = '',
  priority = false,
}: {
  tone?: 'dark' | 'light';
  size?: number;
  subtitle?: string;
  className?: string;
  priority?: boolean;
}) {
  const onDark = tone === 'dark';
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark
        variant={onDark ? 'compact' : 'tile'}
        size={size}
        priority={priority}
        decorative
        className="transition-transform duration-700 ease-editorial group-hover:rotate-[-8deg] group-hover:scale-105"
      />
      <span className="leading-tight">
        <span
          className={`block font-serif text-lg font-semibold tracking-tight ${onDark ? 'text-white' : 'text-stone-900'}`}
        >
          Chalar Farms
        </span>
        {subtitle && (
          <span className={`kicker block whitespace-nowrap text-[8px] min-[400px]:text-[9px] max-[359px]:hidden ${onDark ? 'text-clay-300' : 'text-rust-500'}`}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
