'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Sprout } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import {
  useCountUp,
  useParallax,
  useRotatingIndex,
  useScrollProgressVar,
} from '@/components/motion';
import { HERO_CHIPS, HERO_PILLS, HERO_STATS } from './content';

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

/** Outline pills (eatnaked.co "Bold / Fresh / Tailored"); the highlight walks through them. */
function HeroPills() {
  const index = useRotatingIndex(HERO_PILLS.length, 1900);
  return (
    <div className="flex max-w-[16rem] flex-wrap gap-2" aria-label={HERO_PILLS.join(', ')}>
      {HERO_PILLS.map((pill, i) => (
        <span
          key={pill}
          aria-hidden
          className={[
            'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-700 ease-editorial',
            i === index
              ? 'border-clay-400 bg-clay-400 text-[#0b0b0b]'
              : 'border-white/25 bg-white/[0.03] text-white',
          ].join(' ')}
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

/** Glowing brand mark at the centre of the hero stage, with pointer parallax. */
function HeroMark() {
  const { ref, style } = useParallax(0, 14);
  return (
    <div ref={ref} style={style} className="parallax-layer relative">
      <span className="glow-breathe absolute inset-[22%] rounded-full bg-leaf-400/35 blur-[64px]" aria-hidden />
      <span className="glow-breathe-slow absolute inset-[4%] rounded-full bg-rust-500/25 blur-[90px]" aria-hidden />
      <LogoMark
        variant="glow"
        size={440}
        priority
        className="hero-mark relative h-auto w-[min(70vw,380px)]"
      />
    </div>
  );
}

/* Resting positions of the glass produce labels around the mark (% of stage). */
const CHIP_POSITIONS = [
  { left: '-6%', top: '66%' },
  { left: '74%', top: '62%' },
  { left: '72%', top: '24%' },
  { left: '0%', top: '30%' },
] as const;

export function Hero() {
  const stageRef = useScrollProgressVar<HTMLElement>('exit');

  return (
    <section
      ref={stageRef}
      id="top"
      className="hero-stage relative overflow-hidden bg-[#0b0b0b] text-white"
    >
      {/* Near-black stage with logo-coloured light (eatnaked.co hero) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/chalar/farm-fields-greenhouses.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="ken-burns object-cover opacity-[0.1]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_62%,rgba(77,167,69,0.16),transparent_50%),radial-gradient(ellipse_at_50%_80%,rgba(148,63,40,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b]/80 via-transparent to-[#0b0b0b]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col px-4 pb-10 pt-28 sm:px-6 lg:pt-32">
        {/* ---------- Centred headline ---------- */}
        <div className="hero-copy relative z-10 text-center">
          <p className="reveal inline-flex items-center gap-2 text-[15px] font-medium text-white">
            Grown in Taveta
            <Sprout className="h-4 w-4 text-leaf-400" aria-hidden />
          </p>
          <h1 className="mask-lines display mx-auto mt-4 max-w-5xl text-[clamp(2.4rem,5.2vw,4.6rem)] text-white">
            <span className="mask-line">
              <span>Grown local, packed by hand,</span>
            </span>
            <span className="mask-line">
              <span>
                flown <span className="text-clay-400">fresh.</span>
              </span>
            </span>
          </h1>
        </div>

        {/* ---------- Stage: mark + glass produce labels ---------- */}
        <div className="relative z-0 mx-auto -mt-6 w-[min(92vw,600px)] sm:-mt-16">
          <div className="relative aspect-[1/0.72]">
            <div className="absolute inset-0 flex items-center justify-center">
              <HeroMark />
            </div>
            {HERO_CHIPS.map((chip, i) => (
              <div
                key={chip.name}
                className="hero-chip absolute hidden sm:block"
                style={
                  {
                    ...CHIP_POSITIONS[i % CHIP_POSITIONS.length],
                    '--dx': `${chip.drift[0]}px`,
                    '--dy': `${chip.drift[1]}px`,
                  } as unknown as React.CSSProperties
                }
              >
                <div
                  className={`${i % 2 ? 'float-soft-slow' : 'float-soft'} flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-1.5 pr-5 shadow-lift backdrop-blur-md`}
                  style={{ animationDelay: `${i * -1.7}s` }}
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                    <Image src={chip.image} alt={chip.alt} fill sizes="40px" className="object-cover" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-white">{chip.name}</span>
                    <span className="block text-[11px] text-stone-400">
                      <span className="font-semibold text-clay-300 tnum">{chip.figure}</span> {chip.unit}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- Bottom-left: pills + promise (eatnaked.co "From Our Kitchen to Your Door") ---------- */}
        <div className="hero-copy relative z-10 mt-8 lg:absolute lg:bottom-12 lg:left-6 lg:mt-0 lg:max-w-xs">
          <div className="reveal">
            <HeroPills />
          </div>
          <h2 className="reveal mt-5 text-[1.6rem] font-semibold leading-[1.1] tracking-tight text-white [font-family:var(--font-landing)]">
            From Taveta
            <br />
            to Your Shelf
          </h2>
          <p className="reveal mt-2 text-sm leading-relaxed text-stone-400">
            12+ tonnes of premium fresh herbs every week, all year round — traced from field block to
            airwaybill.
          </p>
          <div className="reveal mt-5 flex flex-wrap gap-2 lg:hidden">
            <a href="#herbs" className="btn rounded-full bg-clay-400 px-5 py-2.5 text-sm font-semibold text-[#0b0b0b]">
              Explore our herbs
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link
              href="/login"
              className="btn rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Staff portal
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ---------- Bottom-centre scroll cue ---------- */}
        <a
          href="#about"
          className="hero-copy group absolute bottom-10 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-stone-500 transition-colors hover:text-white lg:flex"
          aria-label="Scroll to about"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.3em]">Scroll</span>
          <span className="scroll-cue relative h-10 w-px overflow-hidden bg-white/15" />
        </a>
      </div>

      {/* ---------- Published company figures ---------- */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
        <div className="stagger grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
          {HERO_STATS.map((s) => (
            <HeroStat key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
