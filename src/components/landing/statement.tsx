'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { segment, useScrollProgressVar } from '@/components/motion';
import { CERTIFICATIONS, COMPANY, STATEMENT } from './content';

const WORDS = STATEMENT.split(' ');

/**
 * Manifesto whose words light up one by one as the reader scrolls through it,
 * followed by the company story and certification "partner" cards.
 */
export function Statement() {
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const textRef = useScrollProgressVar<HTMLParagraphElement>('pass', (p) => {
    // Highlight runs while the paragraph crosses the middle band of the viewport.
    const start = 0.18;
    const end = 0.62;
    const n = WORDS.length;
    for (let i = 0; i < n; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const a = start + ((end - start) * i) / n;
      const b = start + ((end - start) * (i + 1.6)) / n;
      el.style.setProperty('--w', segment(p, a, b).toFixed(3));
    }
  });

  return (
    <section id="about" className="relative overflow-hidden bg-cream-100 py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="reveal kicker flex items-center gap-2.5 text-rust-500">
          <span className="h-px w-8 bg-rust-400/60" aria-hidden />
          From field to shelf
        </p>

        <p
          ref={textRef}
          className="display display-lg mt-8 max-w-6xl text-stone-900"
          aria-label={STATEMENT}
        >
          {WORDS.map((word, i) => (
            <span
              key={`${word}-${i}`}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              className="scroll-word"
              aria-hidden
            >
              {word}{' '}
            </span>
          ))}
        </p>

        <div className="mt-20 grid items-start gap-14 lg:mt-28 lg:grid-cols-12 lg:gap-16">
          {/* Story */}
          <div className="reveal lg:col-span-5">
            <h2 className="display display-md text-stone-900">
              A certified grower of premium herbs, rooted beside Lake Chala.
            </h2>
            <div className="mt-6 space-y-5 leading-relaxed text-stone-600">
              <p>
                {COMPANY.name} has operated since {COMPANY.established} at Madulu A Village, Chala Ward,
                Taveta — on the Kenya–Tanzania border — producing and exporting over 12 tonnes of
                fresh herbs every week.
              </p>
              <p>
                Around 150 people grow, handle and export the crop, 70% of them women and 75% youth.
                Their work runs on the Chalar Farms ERP: planting, harvest, packhouse, quality,
                payroll, procurement, sales and logistics in one traceable record.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-cream-300 bg-cream-50 p-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src="/images/chalar/fresh-herb-bundle.jpg"
                  alt="Fresh herb bundles packed at Chalar Farms"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </span>
              <p className="flex flex-wrap gap-x-3 gap-y-1 font-serif text-lg font-semibold text-stone-900 tnum">
                <span>150+ team</span>
                <span className="text-clay-400">·</span>
                <span>70% women</span>
                <span className="text-clay-400">·</span>
                <span>75% youth</span>
              </p>
            </div>
          </div>

          {/* Certifications as partner cards */}
          <div className="lg:col-span-7">
            <p className="reveal kicker text-[10px] text-stone-500">Certified &amp; audited</p>
            <div className="stagger mt-5 grid gap-4 sm:grid-cols-2">
              {CERTIFICATIONS.map((c, i) => (
                <article
                  key={c.code}
                  className="partner-card group relative overflow-hidden rounded-3xl border border-cream-300 bg-white p-6 shadow-card transition-all duration-700 ease-editorial hover:-translate-y-1.5 hover:shadow-lift"
                >
                  <span
                    className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl transition-transform duration-1000 ease-editorial group-hover:scale-150 ${
                      i % 2 ? 'bg-leaf-300/30' : 'bg-clay-300/35'
                    }`}
                    aria-hidden
                  />
                  <span className="kicker relative text-[9px] text-stone-400">Certification</span>
                  <p className="relative mt-6 font-serif text-3xl font-semibold tracking-tight text-stone-900">
                    {c.code}
                  </p>
                  <p className="relative mt-2 flex items-center gap-2 text-sm text-stone-500">
                    <ShieldCheck className="h-4 w-4 text-leaf-600" aria-hidden />
                    {c.label}
                  </p>
                </article>
              ))}
            </div>
            <p className="reveal mt-5 text-xs leading-relaxed text-stone-400">
              Certifications as publicly listed by Chalar Farms. Verify current certificate validity
              with the issuing bodies before external reliance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
