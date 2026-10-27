'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import {
  useCountUp,
  useParallax,
  useRotatingIndex,
  useScrollProgressVar,
} from '@/components/motion';
import { COMPANY, HERO_CHIPS, HERO_STATS, ROTATING_WORDS } from './content';

function HeroStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { displayValue, ref } = useCountUp(value, 1400);
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

/** Kicker word that swaps with a vertical slide (eatnaked.co "Bold / Fresh / Tailored"). */
function RotatingWord() {
  const index = useRotatingIndex(ROTATING_WORDS.length, 2100);
  const word = ROTATING_WORDS[index];
  return (
    // All words share one grid cell so the slot is always as wide as the longest word
    // (kicker letter-spacing makes fixed em widths clip "Traceable").
    <span className="relative inline-grid overflow-hidden whitespace-nowrap py-[0.15em] align-bottom">
      {ROTATING_WORDS.map((w) => (
        <span key={`sizer-${w}`} className="invisible [grid-area:1/1]" aria-hidden>
          {w}
        </span>
      ))}
      <span key={word} className="word-swap text-white [grid-area:1/1]" aria-live="polite">
        {word}
      </span>
    </span>
  );
}

/** Glowing brand mark at the centre of the hero stage, with pointer parallax. */
function HeroMark() {
  const { ref, style } = useParallax(0, 14);
  return (
    <div ref={ref} style={style} className="parallax-layer relative">
      <span className="glow-breathe absolute inset-[22%] rounded-full bg-leaf-400/35 blur-[64px]" aria-hidden />
      <span className="glow-breathe-slow absolute inset-[6%] rounded-full bg-rust-500/25 blur-[90px]" aria-hidden />
      <LogoMark
        variant="glow"
        size={460}
        priority
        className="hero-mark relative h-auto w-[min(78vw,460px)]"
      />
    </div>
  );
}

export function Hero() {
  const stageRef = useScrollProgressVar<HTMLElement>('exit');

  return (
    <section
      ref={stageRef}
      id="top"
      className="hero-stage grain relative flex min-h-[100svh] flex-col overflow-hidden bg-[#070d09]"
    >
      {/* Faded field photograph + logo-coloured light */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/images/chalar/farm-fields-greenhouses.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="ken-burns object-cover opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgba(77,167,69,0.20),transparent_55%),radial-gradient(ellipse_at_20%_90%,rgba(148,63,40,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070d09] via-[#070d09]/40 to-[#070d09]/70" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-6 px-4 pb-10 pt-28 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:pb-14 lg:pt-32">
        {/* ---------- Copy ---------- */}
        <div className="hero-copy order-2 lg:order-1 lg:col-span-6">
          <p className="reveal flex flex-wrap items-center gap-x-2.5 gap-y-1 text-clay-300">
            <span className="h-px w-8 bg-clay-400/70" aria-hidden />
            <span className="kicker flex items-center gap-2">
              <RotatingWord />
              <span className="text-stone-400">herbs · Taveta, Kenya · Est. {COMPANY.established}</span>
            </span>
          </p>

          <h1 className="mask-lines display display-xl mt-5 text-white">
            <span className="mask-line">
              <span>Grown in Taveta.</span>
            </span>
            <span className="mask-line">
              <span>Packed by hand.</span>
            </span>
            <span className="mask-line">
              <span>
                <span className="bg-gradient-to-r from-clay-300 via-clay-400 to-leaf-300 bg-clip-text text-transparent">
                  Flown fresh.
                </span>
              </span>
            </span>
          </h1>

          <p className="reveal lede mt-6 max-w-xl text-stone-300">
            More than 12 tonnes of premium fresh herbs every week, all year round — for buyers across
            the United Kingdom, Europe and the Middle East, traced batch by batch from field block
            to airwaybill.
          </p>

          <div className="reveal mt-8 flex flex-wrap gap-3">
            <a
              href="#herbs"
              className="btn rounded-full bg-clay-400 px-6 py-3 text-base font-semibold text-chalar-950 shadow-lift hover:bg-clay-300"
            >
              Explore our herbs
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link
              href="/login"
              className="btn rounded-full border border-white/20 bg-white/[0.06] px-6 py-3 text-base font-semibold text-white backdrop-blur hover:border-white/40 hover:bg-white/10"
            >
              Staff portal
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ---------- Stage: logo + orbiting produce chips ---------- */}
        <div className="order-1 flex justify-center lg:order-2 lg:col-span-6">
          <div className="hero-orbit relative aspect-square w-[min(88vw,560px)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <HeroMark />
            </div>

            {HERO_CHIPS.map((chip, i) => (
              <div
                key={chip.name}
                className="hero-chip absolute hidden sm:block"
                style={
                  {
                    left: `${chip.x}%`,
                    top: `${chip.y}%`,
                    '--dx': `${chip.drift[0]}px`,
                    '--dy': `${chip.drift[1]}px`,
                  } as React.CSSProperties
                }
              >
                <div
                  className={`${i % 2 ? 'float-soft-slow' : 'float-soft'} flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2 pr-4 shadow-lift backdrop-blur-md`}
                  style={{ animationDelay: `${i * -1.7}s` }}
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                    <Image src={chip.image} alt={chip.alt} fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-semibold text-white">{chip.name}</span>
                    <span className="block font-serif text-lg font-semibold text-clay-300 tnum">
                      {chip.figure}
                    </span>
                    <span className="kicker block text-[8px] text-stone-400">{chip.unit}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Stats + scroll cue ---------- */}
      <div className="hero-copy relative mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
        <div className="stagger grid grid-cols-2 gap-6 border-t border-white/10 pt-7 sm:grid-cols-4">
          {HERO_STATS.map((s) => (
            <HeroStat key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </div>
        <a
          href="#about"
          className="group absolute -top-16 right-6 hidden flex-col items-center gap-2 text-stone-400 transition-colors hover:text-white lg:flex"
          aria-label="Scroll to about"
        >
          <span className="kicker text-[9px] [writing-mode:vertical-rl]">Scroll</span>
          <span className="scroll-cue relative h-12 w-px overflow-hidden bg-white/15" />
        </a>
      </div>
    </section>
  );
}
