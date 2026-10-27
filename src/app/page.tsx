import { LandingShell } from '@/components/landing/landing-shell';
import { SmoothScroll } from '@/components/landing/smooth-scroll';
import { Preloader, PRELOADER_BOOT_SCRIPT } from '@/components/landing/preloader';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Ticker } from '@/components/landing/marquee';
import { Statement } from '@/components/landing/statement';
import { Pillars } from '@/components/landing/pillars';
import { HerbOrbit } from '@/components/landing/herb-orbit';
import { ExpandMedia } from '@/components/landing/expand-media';
import { Journey } from '@/components/landing/journey';
import { Markets } from '@/components/landing/markets';
import { Quality, SiteFooter } from '@/components/landing/sections';
import { SlideLines } from '@/components/landing/slide-lines';
import { Join } from '@/components/landing/join';
import { SectionIndex } from '@/components/landing/section-index';
import { ContactCorner } from '@/components/landing/contact-corner';
import { TICKER_ITEMS } from '@/components/landing/content';

/**
 * Public landing page.
 *
 * Scroll language and theme adapted from eatnaked.co (Awwwards Honorable
 * Mention, 2026) for a Kenyan herb grower-exporter:
 *   brand preloader with counter · inertial smooth scroll · glowing logo hero
 *   with orbiting produce chips and rotating words · fact ticker · scroll-lit
 *   manifesto · certification "partner" cards · sticky stacking cards ·
 *   pinned herb orbit that assembles on scroll · pill-to-fullscreen media
 *   reveal · sticky farm-to-flight scrollytelling · endless draggable market
 *   carousel · opposing sliding headlines · draggable physics word pile.
 *
 * Every effect is disabled or reduced to its final state under
 * prefers-reduced-motion, and every figure/name is published company fact.
 */
export default function LandingPage() {
  return (
    <>
      {/* Runs before first paint so the preloader never flashes on repeat visits. */}
      <script dangerouslySetInnerHTML={{ __html: PRELOADER_BOOT_SCRIPT }} />
      <SmoothScroll />
      <Preloader />
      <LandingShell>
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
          <Statement />
          <Pillars />
          <HerbOrbit />
          <ExpandMedia />
          <Journey />
          <Markets />
          <Quality />
          <SlideLines />
          <Join />
        </main>

        <SiteFooter />
        <SectionIndex />
        <ContactCorner />
      </LandingShell>
    </>
  );
}
