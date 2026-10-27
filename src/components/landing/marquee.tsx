'use client';

import { Leaf } from 'lucide-react';
import { CUSTOMERS } from './content';

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
      className="marquee border-y border-white/10 bg-chalar-950 py-4"
      style={{ ['--marquee-duration' as string]: `${duration}s` }}
    >
      <div className="marquee-track" data-direction={reverse ? 'reverse' : 'forward'}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Customer wordmark band — names exactly as published by Chalar Farms. */
export function CustomerMarquee({ duration = 64 }: { duration?: number }) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-stretch" aria-hidden={hidden || undefined}>
      {CUSTOMERS.map((c) => (
        <article
          key={c.name}
          className="group mx-2.5 flex w-[248px] shrink-0 flex-col justify-between rounded-xl border border-stone-200/80 bg-white px-5 py-4 shadow-card transition-all duration-500 ease-editorial hover:-translate-y-1 hover:border-clay-200 hover:shadow-lift"
        >
          <span className="kicker text-[9px] text-clay-500">{c.market}</span>
          <span className="mt-3 font-serif text-xl font-semibold tracking-tight text-stone-900 transition-colors group-hover:text-chalar-700">
            {c.name}
          </span>
          <span className="mt-2 h-px w-full origin-left scale-x-[0.18] bg-stone-300 transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
        </article>
      ))}
    </div>
  );

  return (
    <div
      className="marquee"
      style={{ ['--marquee-duration' as string]: `${duration}s` }}
    >
      <div className="marquee-track py-1">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
