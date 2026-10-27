'use client';

import { useActiveSection } from '@/components/motion';

/**
 * Fixed right-hand section index (eatnaked.co "Fresh · Source · Goals …").
 * The active section's label turns clay and its rule becomes a moving wave.
 * Desktop only; ids must be listed in DOM order.
 */
const INDEX = [
  { id: 'top', label: 'Fresh' },
  { id: 'about', label: 'About' },
  { id: 'grow', label: 'Grow' },
  { id: 'herbs', label: 'Herbs' },
  { id: 'farm', label: 'Farm' },
  { id: 'journey', label: 'Journey' },
  { id: 'markets', label: 'Markets' },
  { id: 'quality', label: 'Quality' },
  { id: 'contact', label: 'Contact' },
] as const;

const IDS = INDEX.map((i) => i.id) as unknown as string[];
/** Sections with a dark background — the index switches to light text over them. */
const DARK = new Set(['top', 'herbs', 'journey', 'contact']);

export function SectionIndex() {
  const active = useActiveSection(IDS, 420);
  const onDark = active === null || DARK.has(active);

  return (
    <nav
      aria-label="Page sections"
      className={[
        'fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 rounded-2xl px-2.5 py-2 backdrop-blur-md transition-colors duration-500 xl:block 2xl:right-5 2xl:bg-transparent 2xl:backdrop-blur-none',
        onDark ? 'bg-black/25' : 'bg-cream-50/75 shadow-sm ring-1 ring-stone-900/5',
      ].join(' ')}
    >
      <ol className="flex flex-col items-end gap-0.5">
        {INDEX.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'group flex items-center gap-2.5 py-1 text-[11px] font-medium transition-colors duration-500',
                  isActive
                    ? 'text-clay-500'
                    : onDark
                      ? 'text-white/45 hover:text-white'
                      : 'text-stone-500 hover:text-stone-900',
                ].join(' ')}
              >
                {/* Labels are always visible on wide screens; on laptops only the active one shows. */}
                <span className={isActive ? '' : 'sr-only 2xl:not-sr-only'}>{item.label}</span>
                <span className="relative flex h-2 w-6 items-center overflow-hidden" aria-hidden>
                  {isActive ? (
                    <svg viewBox="0 0 48 8" className="index-wave h-2 w-12 shrink-0 text-clay-500">
                      <path
                        d="M0 4 Q3 0 6 4 T12 4 T18 4 T24 4 T30 4 T36 4 T42 4 T48 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                  ) : (
                    <span
                      className={`h-px w-full transition-colors ${onDark ? 'bg-white/25 group-hover:bg-white/60' : 'bg-stone-400/60 group-hover:bg-stone-700'}`}
                    />
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
