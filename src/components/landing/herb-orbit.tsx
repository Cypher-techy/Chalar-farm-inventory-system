'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { easeInOut, segment, useScrollProgressVar } from '@/components/motion';
import { HERBS } from './content';

/**
 * Pinned "Herbs that matter" stage. While the section is pinned, the eight
 * herbs fly in one after another and settle into an orbit around the packhouse
 * crate (eatnaked.co assembles a bowl from its ingredients the same way), then
 * the ring turns gently as you keep scrolling.
 */
export function HerbOrbit() {
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const n = HERBS.length;

  const pinRef = useScrollProgressVar<HTMLDivElement>('pin', (p) => {
    let settled = 0;
    for (let i = 0; i < n; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const start = 0.04 + (i / n) * 0.52;
      const e = easeInOut(segment(p, start, start + 0.2));
      if (e > 0.98) settled++;
      el.style.setProperty('--e', e.toFixed(3));
    }
    if (counterRef.current) counterRef.current.textContent = String(settled).padStart(2, '0');
  });

  return (
    <section id="herbs" className="relative bg-[#070d09] text-white">
      <div ref={pinRef} className="orbit-pin relative h-[320svh] motion-reduce:h-auto">
        <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden motion-reduce:static motion-reduce:h-auto motion-reduce:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(77,167,69,0.16),transparent_55%)]" aria-hidden />

          {/* Heading row */}
          <div className="relative mx-auto flex w-full max-w-7xl items-end justify-between gap-6 px-4 pt-24 sm:px-6 lg:pt-28">
            <div className="max-w-xl">
              <p className="kicker flex items-center gap-2.5 text-clay-300">
                <span className="h-px w-8 bg-clay-400/70" aria-hidden />
                What we grow
              </p>
              <h2 className="display display-lg mt-4">Herbs that matter.</h2>
            </div>
            <p className="hidden text-right sm:block">
              <span ref={counterRef} className="display text-5xl text-clay-400 tnum">
                00
              </span>
              <span className="text-stone-500 tnum"> / {String(n).padStart(2, '0')}</span>
              <span className="kicker mt-1 block text-[9px] text-stone-500">Varieties</span>
            </p>
          </div>

          {/* Orbit stage */}
          <div className="relative flex flex-1 items-center justify-center">
            <div className="orbit-stage relative aspect-square">
              {/* Centre: the crate */}
              <div className="orbit-core absolute left-1/2 top-1/2 overflow-hidden rounded-full ring-1 ring-white/10">
                <Image
                  src="/images/chalar/packhouse-herb-crates.jpg"
                  alt="Herbs in crates at the Chalar Farms packhouse"
                  fill
                  sizes="260px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="kicker absolute inset-x-0 bottom-[16%] text-center text-[8px] text-white sm:text-[9px]">
                  Packhouse · Taveta
                </span>
              </div>
              <div className="orbit-ring absolute inset-[6%] rounded-full border border-dashed border-white/10" aria-hidden />

              {HERBS.map((herb, i) => (
                <div
                  key={herb.name}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="orbit-item absolute left-1/2 top-1/2"
                  style={{ '--angle': `${(i / n) * 360 - 90}deg` } as React.CSSProperties}
                >
                  <div className="orbit-item-inner flex flex-col items-center text-center">
                    <span className="orbit-thumb relative block overflow-hidden rounded-full ring-2 ring-white/15">
                      <Image src={herb.image} alt="" fill sizes="96px" className="object-cover" />
                    </span>
                    <span className="orbit-label mt-2 block">
                      <span className="block text-xs font-semibold text-white sm:text-sm">{herb.name}</span>
                      <span className="block font-serif text-sm font-semibold text-clay-300 tnum sm:text-base">
                        {herb.figure}
                      </span>
                      <span className="kicker hidden text-[8px] text-stone-400 sm:block">{herb.unit}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative mx-auto w-full max-w-7xl px-4 pb-8 text-xs text-stone-500 sm:px-6">
            Weekly volumes as published by Chalar Farms. Chives are supplied through our sister
            farm, Royal Herbs Exporters.
          </p>
        </div>
      </div>

      {/* Screen-reader / no-JS list of the same data */}
      <ul className="sr-only">
        {HERBS.map((h) => (
          <li key={h.name}>
            {h.name}: {h.figure} {h.unit}. {h.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
