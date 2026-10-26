'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useCountUp, useParallax } from '@/components/motion';
import { COMPANY, HERO_CHIPS, HERO_STATS } from './content';

function HeroStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { displayValue, ref } = useCountUp(value, 1200);
  return (
    <div className="text-center sm:text-left">
      <span ref={ref} className="display block text-4xl text-white tnum sm:text-[2.75rem]">
        {Math.round(displayValue).toLocaleString('en-KE')}
        <span className="text-clay-400">{suffix}</span>
      </span>
      <span className="kicker mt-2 block text-[10px] text-clay-300/90">{label}</span>
    </div>
  );
}

function FloatingChip({
  name,
  figure,
  unit,
  image,
  alt,
  depth,
  className,
}: (typeof HERO_CHIPS)[number]) {
  const { ref, style } = useParallax(depth, 6);
  return (
    <div ref={ref} style={style} className={`parallax-layer ${className}`}>
      <div className="float-soft flex items-center gap-3 rounded-2xl border border-white/15 bg-chalar-950/45 p-2.5 pr-4 shadow-lift backdrop-blur-md">
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
          <Image
            src={image}
            alt={alt}
            fill
            sizes="56px"
            className="object-cover"
          />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">{name}</span>
          <span className="mt-0.5 block font-serif text-lg font-semibold text-clay-300 tnum">
            {figure}
          </span>
          <span className="kicker block text-[9px] text-stone-300">{unit}</span>
        </span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="grain relative flex min-h-[100svh] items-end overflow-hidden bg-chalar-950">
      <div className="absolute inset-0">
        <Image
          src="/images/chalar/farm-fields-greenhouses.jpg"
          alt="Chalar Farms herb fields and greenhouses under a bright Taita-Taveta sky"
          fill
          priority
          sizes="100vw"
          className="ken-burns object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chalar-950 via-chalar-950/70 to-chalar-950/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-chalar-950/80 via-transparent to-chalar-950/40" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-32 sm:px-6 lg:pb-20 lg:pt-40">
        <div className="grid items-end gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="reveal inline-flex items-center gap-2.5 text-clay-300">
              <span className="h-px w-8 bg-clay-400/70" aria-hidden />
              <span className="kicker">
                Taveta · Kenya · Est. {COMPANY.established}
              </span>
            </p>

            <h1 className="mask-lines display display-xl mt-6 text-white">
              <span className="mask-line">
                <span>Grown in Taveta.</span>
              </span>
              <span className="mask-line">
                <span>Packed at dawn.</span>
              </span>
              <span className="mask-line">
                <span className="text-clay-300">Flown to Europe.</span>
              </span>
            </h1>

            <p className="reveal lede mt-7 max-w-xl text-stone-200">
              More than 12 tonnes of fresh herbs every week, all year round — and every batch
              traceable from field block to airwaybill inside the Chalar Farms ERP.
            </p>

            <div className="reveal mt-9 flex flex-wrap gap-3">
              <a
                href="#herbs"
                className="btn bg-clay-400 px-6 py-3 text-base font-semibold text-chalar-950 shadow-lift hover:bg-clay-300"
              >
                Explore our herbs
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                href="/login"
                className="btn border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:border-white/45 hover:bg-white/15"
              >
                Open ERP portal
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Floating produce chips — parallax + gentle drift (desktop) */}
          <div className="hidden lg:col-span-5 lg:block">
            {HERO_CHIPS.map((chip) => (
              <FloatingChip key={chip.name} {...chip} />
            ))}
          </div>
        </div>

        {/* Compact produce strip for small screens */}
        <div className="stagger mt-10 grid grid-cols-3 gap-2 lg:hidden">
          {HERO_CHIPS.map((chip) => (
            <div
              key={chip.name}
              className="rounded-xl border border-white/12 bg-chalar-950/45 p-3 backdrop-blur-md"
            >
              <span className="block text-xs font-semibold text-white">{chip.name}</span>
              <span className="mt-1 block font-serif text-base font-semibold text-clay-300 tnum">
                {chip.figure}
              </span>
            </div>
          ))}
        </div>

        <div className="stagger mt-12 grid grid-cols-2 gap-6 border-t border-white/15 pt-8 sm:grid-cols-4 lg:mt-16">
          {HERO_STATS.map((s) => (
            <HeroStat key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
