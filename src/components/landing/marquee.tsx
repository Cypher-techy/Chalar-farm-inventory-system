'use client';

import { Leaf } from 'lucide-react';

/**
 * Infinite horizontal marquee. The track holds the list twice and translates
 * -50%, which loops seamlessly. Pauses on hover and on keyboard focus; fully
 * disabled under prefers-reduced-motion (see globals.css).
 */
export function Ticker({
  items,
  duration = 52,
  reverse = false,
}: {
  items: readonly string[];
  duration?: number;
  reverse?: boolean;
}) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <span key={item} className="flex items-center">
          <span className="kicker whitespace-nowrap px-6 text-[11px] text-stone-300 sm:text-xs">
            {item}
          </span>
          <Leaf className="h-3 w-3 shrink-0 text-clay-400/80" aria-hidden />
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="marquee border-y border-white/10 bg-[#070d09] py-5"
      style={{ ['--marquee-duration' as string]: `${duration}s` }}
    >
      <div className="marquee-track" data-direction={reverse ? 'reverse' : 'forward'}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
