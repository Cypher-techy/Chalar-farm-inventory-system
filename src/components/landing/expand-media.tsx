'use client';

import Image from 'next/image';
import { easeInOut, segment, useScrollProgressVar } from '@/components/motion';
import { COMPANY } from './content';

/**
 * "Our farm [media] in action" — eatnaked.co's showreel reveal. While pinned,
 * a small rounded window between the two words grows to fill the screen, the
 * words part and fade, and a location caption settles in.
 */
export function ExpandMedia() {
  const pinRef = useScrollProgressVar<HTMLDivElement>('pin', (p, node) => {
    const e = easeInOut(segment(p, 0.05, 0.72));
    const caption = easeInOut(segment(p, 0.74, 0.92));
    node.style.setProperty('--e', e.toFixed(4));
    node.style.setProperty('--c', caption.toFixed(3));
  });

  return (
    <section className="relative bg-cream-100" aria-label="Our farm in action">
      <div ref={pinRef} className="expand-pin relative h-[260svh] motion-reduce:h-auto">
        <div className="sticky top-0 h-[100svh] overflow-hidden motion-reduce:relative">
          {/* Media window (clip-path grows from a pill to full-bleed) */}
          <div className="expand-media absolute inset-0">
            <Image
              src="/images/chalar/farm-aerial-taveta.jpg"
              alt="Aerial view of the Chalar Farms production blocks near Taveta"
              fill
              sizes="100vw"
              className="expand-image object-cover"
            />
            <div className="expand-shade absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
          </div>

          {/* Split headline */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="expand-word expand-word-left display display-xl text-stone-900">Our farm</span>
            <span className="expand-word expand-word-right display display-xl text-stone-900">in action</span>
          </div>

          <p className="expand-kicker kicker pointer-events-none absolute inset-x-0 top-[18%] text-center text-rust-500">
            Where it begins
          </p>

          {/* Caption once full-bleed */}
          <div className="expand-caption absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 text-white sm:px-6 sm:pb-14">
            <p className="kicker text-[10px] text-clay-300">Madulu A Village · Chala Ward · Taveta</p>
            <p className="display display-lg mt-3 max-w-3xl">
              Greenhouse and open field, beside Lake Chala.
            </p>
            <p className="mt-3 max-w-xl text-sm text-stone-200">
              {COMPANY.name}&rsquo;s production site on the Kenya–Tanzania border, operating since{' '}
              {COMPANY.established}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
