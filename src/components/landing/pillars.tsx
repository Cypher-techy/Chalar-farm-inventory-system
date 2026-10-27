'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { easeInOut, segment, useScrollProgressVar } from '@/components/motion';
import { PILLARS } from './content';

const TONES = {
  forest: {
    card: 'bg-chalar-900 text-white',
    kicker: 'text-leaf-300',
    tagline: 'text-clay-300',
    body: 'text-stone-300',
    fact: 'border-white/15 bg-white/[0.06] text-stone-100',
    cta: 'bg-white text-chalar-950 hover:bg-cream-100',
    index: 'text-white/10',
  },
  clay: {
    card: 'bg-clay-300 text-chalar-950',
    kicker: 'text-rust-700',
    tagline: 'text-rust-700',
    body: 'text-chalar-950/80',
    fact: 'border-chalar-950/15 bg-white/40 text-chalar-950',
    cta: 'bg-chalar-950 text-white hover:bg-chalar-800',
    index: 'text-chalar-950/10',
  },
  rust: {
    card: 'bg-rust-600 text-white',
    kicker: 'text-clay-200',
    tagline: 'text-clay-200',
    body: 'text-white/80',
    fact: 'border-white/20 bg-white/10 text-white',
    cta: 'bg-cream-100 text-rust-700 hover:bg-white',
    index: 'text-white/10',
  },
} as const;

/**
 * Sticky stacking cards. Each card pins below the header; as the next card
 * slides over it, the one underneath scales back and dims — eatnaked.co's
 * "Designed for your taste" stack, rebuilt for Grow → Pack → Export.
 */
export function Pillars() {
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const n = PILLARS.length;

  const wrapRef = useScrollProgressVar<HTMLDivElement>('pin', (p) => {
    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      // card i is covered while the next card travels: window [i/(n-1)…(i+1)/(n-1)] of the pin
      const covered = i < n - 1 ? easeInOut(segment(p, i / (n - 1) - 0.02, (i + 1) / (n - 1))) : 0;
      el.style.setProperty('--covered', covered.toFixed(3));
    }
  });

  return (
    <section className="relative bg-cream-100 pb-24 lg:pb-32" aria-labelledby="pillars-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-10 lg:pb-14">
          <div className="reveal max-w-2xl">
            <p className="kicker flex items-center gap-2.5 text-rust-500">
              <span className="h-px w-8 bg-rust-400/60" aria-hidden />
              What we do
            </p>
            <h2 id="pillars-heading" className="display display-lg mt-5 text-stone-900">
              Built for your shelf, from the soil up.
            </h2>
          </div>
          <p className="reveal max-w-sm text-stone-600">
            Three disciplines, one record. Each step writes to the ERP, so what you receive can be
            traced back to where and when it was grown.
          </p>
        </div>

        <div ref={wrapRef} className="relative">
          {PILLARS.map((pillar, i) => {
            const tone = TONES[pillar.tone];
            return (
              <article
                key={pillar.index}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`stack-card sticky mb-8 overflow-hidden rounded-[2rem] shadow-lift last:mb-0 ${tone.card}`}
                style={{ top: `calc(5.5rem + ${i * 1.25}rem)` }}
              >
                <div className="grid min-h-[min(78svh,640px)] gap-0 lg:grid-cols-2">
                  <div className="relative flex flex-col justify-between p-7 sm:p-10 lg:p-14">
                    <span
                      className={`display pointer-events-none absolute -right-2 -top-6 text-[9rem] leading-none sm:text-[12rem] ${tone.index}`}
                      aria-hidden
                    >
                      {pillar.index}
                    </span>
                    <div className="relative">
                      <p className={`kicker text-[10px] ${tone.kicker}`}>
                        {pillar.index} — {pillar.kicker}
                      </p>
                      <h3 className="display display-lg mt-6">{pillar.title}</h3>
                      <p className={`mt-3 font-serif text-xl italic ${tone.tagline}`}>{pillar.tagline}</p>
                      <p className={`mt-6 max-w-md leading-relaxed ${tone.body}`}>{pillar.body}</p>
                    </div>
                    <div className="relative mt-10">
                      <ul className="flex flex-wrap gap-2">
                        {pillar.facts.map((fact) => (
                          <li key={fact} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${tone.fact}`}>
                            {fact}
                          </li>
                        ))}
                      </ul>
                      <a
                        href={pillar.href}
                        className={`btn group/cta mt-8 rounded-full px-5 py-2.5 font-semibold ${tone.cta}`}
                      >
                        {pillar.cta}
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-500 ease-editorial group-hover/cta:translate-x-1"
                          aria-hidden
                        />
                      </a>
                    </div>
                  </div>
                  <div className="relative min-h-[260px] overflow-hidden lg:m-4 lg:rounded-[1.5rem]">
                    <Image
                      src={pillar.image}
                      alt={pillar.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="stack-image object-cover"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
