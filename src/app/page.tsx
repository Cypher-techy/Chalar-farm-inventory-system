'use client';

import { useScrollReveal } from '@/components/motion';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Ticker } from '@/components/landing/marquee';
import { About, ContactCta, Customers, Quality, SiteFooter } from '@/components/landing/sections';
import { Journey } from '@/components/landing/journey';
import { HerbRail } from '@/components/landing/herb-rail';
import { TICKER_ITEMS } from '@/components/landing/content';

/**
 * Public landing page.
 *
 * Interaction model borrowed from award-winning produce-brand sites
 * (e.g. eatnaked.co) and adapted to Chalar Farms: a mask-reveal display
 * headline, floating labelled produce chips with pointer/scroll parallax,
 * an infinite fact ticker, sticky scrollytelling for the farm-to-flight
 * chain, a drag-to-scroll crop rail and a customer wordmark marquee.
 *
 * All animation is IntersectionObserver-driven and disabled under
 * prefers-reduced-motion. Every number and name is published company fact.
 */
export default function LandingPage() {
  const rootRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={rootRef} className="bg-white text-stone-800">
      <a
        href="#about"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-chalar-950 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main>
        <Hero />
        <Ticker items={TICKER_ITEMS} duration={54} />
        <About />
        <Journey />
        <HerbRail />
        <Quality />
        <Customers />
        <ContactCta />
      </main>

      <SiteFooter />
    </div>
  );
}
