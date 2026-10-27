'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Mail, Phone } from 'lucide-react';
import { LogoLockup } from '@/components/brand/logo';
import { useActiveSection, useScrollProgress } from '@/components/motion';
import { COMPANY } from './content';

/** Centre nav (eatnaked.co "• About • FAQs • Community • Contact"). */
export const NAV_LINKS = [
  { href: '#about', id: 'about', label: 'About' },
  { href: '#herbs', id: 'herbs', label: 'Herbs' },
  { href: '#markets', id: 'markets', label: 'Markets' },
  { href: '#quality', id: 'quality', label: 'Quality' },
  { href: '#contact', id: 'contact', label: 'Contact' },
] as const;

/** Full-screen menu: every section, in page order. */
const MENU_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#grow', label: 'Grow, pack, export' },
  { href: '#herbs', label: 'Our herbs' },
  { href: '#farm', label: 'The farm' },
  { href: '#journey', label: 'Farm to flight' },
  { href: '#markets', label: 'Markets' },
  { href: '#quality', label: 'Quality' },
  { href: '#contact', label: 'Contact' },
] as const;

const NAV_IDS = NAV_LINKS.map((l) => l.id) as unknown as string[];

/** Two offset lines (eatnaked.co menu glyph) that cross into an X when open. */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span className="relative block h-3 w-12" aria-hidden>
      <span
        className={`absolute left-0 top-0 h-[2px] rounded-full bg-white transition-all duration-500 ease-editorial ${open ? 'w-7 translate-x-2.5 translate-y-[5px] rotate-45' : 'w-12'}`}
      />
      <span
        className={`absolute bottom-0 h-[2px] rounded-full bg-white transition-all duration-500 ease-editorial ${open ? 'left-0 w-7 translate-x-2.5 -translate-y-[5px] -rotate-45' : 'left-3 w-9'}`}
      />
    </span>
  );
}

export function SiteHeader() {
  const progress = useScrollProgress();
  const active = useActiveSection(NAV_IDS);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-editorial',
        scrolled && !open
          ? 'bg-[#0b0b0b]/80 backdrop-blur-xl'
          : 'bg-gradient-to-b from-[#0b0b0b]/70 to-transparent',
      ].join(' ')}
    >
      <nav
        className={[
          'relative z-10 mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 transition-all duration-500 ease-editorial sm:px-8',
          scrolled ? 'h-16' : 'h-20 lg:h-24',
        ].join(' ')}
        aria-label="Primary"
      >
        {/* Left: logo + menu glyph */}
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="group flex items-center" onClick={() => setOpen(false)} aria-label="Chalar Farms home">
            <LogoLockup tone="dark" size={scrolled ? 38 : 44} subtitle="Taveta · Kenya" priority />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 items-center rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-400"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <MenuGlyph open={open} />
          </button>
        </div>

        {/* Centre: dotted nav */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={[
                  'inline-flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-300',
                  active === l.id ? 'text-clay-400' : 'text-white hover:text-clay-300',
                ].join(' ')}
              >
                <span className="text-[10px]" aria-hidden>
                  •
                </span>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Right: portal link + primary CTA */}
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden text-[15px] font-medium text-clay-400 transition-colors hover:text-clay-300 md:inline"
          >
            Staff portal?
          </Link>
          <a
            href="#contact"
            className="group hidden items-center gap-3 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-5 text-[15px] font-semibold text-white ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[0.14] sm:inline-flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-500 text-white transition-transform duration-500 ease-editorial group-hover:rotate-[-45deg]">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
            Source herbs
          </a>
        </div>
      </nav>

      {/* Reading progress hairline */}
      <div
        className={`relative z-10 h-px w-full origin-left bg-clay-400/70 transition-opacity ${scrolled && !open ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />

      {/* Full-screen menu */}
      <div
        id="site-menu"
        data-lenis-prevent
        className={[
          'fixed inset-0 overflow-y-auto bg-[#0b0b0b] transition-[clip-path,visibility] duration-700 ease-editorial',
          open ? 'visible [clip-path:inset(0_0_0_0)]' : 'invisible [clip-path:inset(0_0_100%_0)]',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="mx-auto grid min-h-full max-w-[90rem] gap-12 px-4 pb-12 pt-28 sm:px-8 lg:grid-cols-12 lg:pt-36">
          <ol className="lg:col-span-8">
            {MENU_LINKS.map((l, i) => (
              <li key={l.href} className="border-b border-white/10">
                <a
                  href={l.href}
                  tabIndex={open ? undefined : -1}
                  onClick={() => setOpen(false)}
                  className="group flex items-baseline gap-5 py-3 text-white transition-colors hover:text-clay-400"
                  style={{ transitionDelay: open ? `${80 + i * 40}ms` : '0ms' }}
                >
                  <span className="w-8 text-xs font-medium text-white/40 tnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[clamp(1.75rem,4.4vw,3.25rem)] font-semibold leading-tight tracking-tight [font-family:var(--font-landing)]">
                    {l.label}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <div className="flex flex-col justify-end gap-6 text-sm text-stone-400 lg:col-span-4">
            <p className="kicker text-[10px] text-clay-400">Chalar Farms Limited</p>
            <p className="leading-relaxed">{COMPANY.location}</p>
            <a href={COMPANY.emailHref} tabIndex={open ? undefined : -1} className="inline-flex items-center gap-2 text-white hover:text-clay-300">
              <Mail className="h-4 w-4" aria-hidden />
              {COMPANY.email}
            </a>
            <a href={COMPANY.phoneHref} tabIndex={open ? undefined : -1} className="inline-flex items-center gap-2 text-white hover:text-clay-300">
              <Phone className="h-4 w-4" aria-hidden />
              {COMPANY.phone}
            </a>
            <Link
              href="/login"
              tabIndex={open ? undefined : -1}
              onClick={() => setOpen(false)}
              className="btn w-fit rounded-full bg-clay-500 px-6 py-3 font-semibold text-white hover:bg-clay-400"
            >
              Staff portal
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
