'use client';

import Image from 'next/image';
import { useScrollProgressVar } from '@/components/motion';

/**
 * Giant opposing lines that slide horizontally as the section scrolls past —
 * eatnaked.co's "From our kitchen … To your table" device.
 */
export function SlideLines() {
  const ref = useScrollProgressVar<HTMLElement>('pass');

  return (
    <section ref={ref} className="slide-lines relative overflow-hidden bg-cream-100 py-24 lg:py-32" aria-label="From our fields to your table">
      <p className="slide-line slide-line-a display whitespace-nowrap text-[clamp(3.4rem,11vw,10rem)] text-stone-900">
        From our fields <span className="text-rust-500">·</span> From our fields
      </p>

      <div className="relative mx-auto my-8 flex max-w-7xl flex-col items-center gap-6 px-4 sm:my-10 sm:flex-row sm:justify-center sm:gap-10 sm:px-6">
        <span className="slide-pill relative block h-28 w-56 overflow-hidden rounded-full shadow-lift sm:h-36 sm:w-80">
          <Image
            src="/images/chalar/fresh-herb-bundle.jpg"
            alt="Fresh herb bundles from Chalar Farms"
            fill
            sizes="320px"
            className="object-cover"
          />
        </span>
        <p className="max-w-sm text-center text-stone-600 sm:text-left">
          <span className="kicker block text-[10px] text-rust-500">Fresh, high-quality herbs</span>
          <span className="mt-2 block leading-relaxed">
            Hand-picked and expertly packed to meet global standards for quality, safety and taste.
          </span>
        </p>
      </div>

      <p className="slide-line slide-line-b display whitespace-nowrap text-right text-[clamp(3.4rem,11vw,10rem)] text-stone-900">
        to your table <span className="text-leaf-600">·</span> to your table
      </p>
    </section>
  );
}
