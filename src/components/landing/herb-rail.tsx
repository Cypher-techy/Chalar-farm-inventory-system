'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { useDragScroll } from '@/components/motion';
import { HERBS } from './content';

/**
 * Drag-to-scroll produce rail. Pointer drag, snap points, arrow buttons and
 * native keyboard scrolling all work; no autoplay, so nothing moves without
 * the visitor asking for it.
 */
export function HerbRail() {
  const { ref, isDragging, handlers, nudge } = useDragScroll<HTMLDivElement>();

  return (
    <section id="herbs" className="relative overflow-hidden bg-stone-50 py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="reveal max-w-xl">
            <p className="kicker flex items-center gap-2.5 text-clay-600">
              <span className="h-px w-8 bg-clay-400/70" aria-hidden />
              What we grow
            </p>
            <h2 className="display display-lg mt-5 text-stone-900">
              Eight herbs, picked by hand every week
            </h2>
            <p className="lede mt-5">
              Weekly volumes below are the figures Chalar Farms publishes. Drag the rail — or use
              the arrows — to move through the crop.
            </p>
          </div>

          <div className="reveal flex items-center gap-3">
            <span className="kicker hidden items-center gap-2 text-stone-400 sm:flex">
              <MoveHorizontal className="h-4 w-4" aria-hidden />
              Drag
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => nudge(-1)}
                className="btn h-11 w-11 rounded-full border border-stone-300 bg-white p-0 text-stone-600 hover:border-chalar-500 hover:text-chalar-700"
                aria-label="Previous herbs"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => nudge(1)}
                className="btn h-11 w-11 rounded-full border border-stone-300 bg-white p-0 text-stone-600 hover:border-chalar-500 hover:text-chalar-700"
                aria-label="Next herbs"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={ref}
        {...handlers}
        className={[
          'drag-rail mt-12 flex gap-5 overflow-x-auto px-4 pb-8 sm:px-6 lg:px-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]',
          isDragging ? 'is-dragging' : '',
        ].join(' ')}
        aria-label="Herb varieties and published weekly volumes"
      >
        {HERBS.map((herb, i) => (
          <article
            key={herb.name}
            data-rail-card
            className="group relative w-[262px] shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card transition-all duration-500 ease-editorial hover:-translate-y-1.5 hover:border-clay-200 hover:shadow-lift sm:w-[300px]"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={herb.image}
                alt={`${herb.name} grown at Chalar Farms`}
                fill
                sizes="(max-width: 640px) 80vw, 300px"
                className="object-cover transition-transform duration-[1.2s] ease-editorial group-hover:scale-[1.07]"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-chalar-950/75 via-chalar-950/5 to-transparent" />
              <span className="kicker absolute left-4 top-4 rounded-full bg-chalar-950/55 px-2.5 py-1 text-[9px] text-clay-200 backdrop-blur-sm tnum">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <h3 className="font-serif text-2xl font-semibold tracking-tight text-white">
                  {herb.name}
                </h3>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="display text-3xl text-clay-300 tnum">{herb.figure}</span>
                  <span className="kicker text-[9px] text-stone-200">{herb.unit}</span>
                </p>
              </div>
            </div>
            <p className="px-4 py-4 text-sm leading-relaxed text-stone-600">{herb.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
