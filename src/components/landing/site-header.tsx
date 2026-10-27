'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Leaf, Menu, X, ArrowUpRight } from 'lucide-react';
import { useActiveSection, useScrollProgress } from '@/components/motion';
import { COMPANY } from './content';

export const NAV_LINKS = [
  { href: '#about', id: 'about', label: 'About' },
  { href: '#journey', id: 'journey', label: 'Farm to flight' },
  { href: '#herbs', id: 'herbs', label: 'Our herbs' },
  { href: '#quality', id: 'quality', label: 'Quality' },
  { href: '#customers', id: 'customers', label: 'Customers' },
  { href: '#contact', id: 'contact', label: 'Contact' },
] as const;

const NAV_IDS = NAV_LINKS.map((l) => l.id) as unknown as string[];

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

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-editorial',
        scrolled || open
          ? 'border-b border-white/10 bg-chalar-950/88 backdrop-blur-xl'
          : 'border-b border-transparent bg-gradient-to-b from-chalar-950/70 to-transparent',
      ].join(' ')}
    >
      <nav
        className={[
          'mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-500 ease-editorial sm:px-6',
          scrolled ? 'h-16' : 'h-20',
        ].join(' ')}
        aria-label="Primary"
      >
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-chalar-600 text-white shadow-sm transition-transform duration-500 ease-editorial group-hover:-rotate-6">
            <Leaf className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-lg font-semibold tracking-tight text-white">
              Chalar Farms
            </span>
            <span className="kicker block text-[9px] text-clay-300">{COMPANY.tagline}</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-active={active === l.id}
              className={[
                'link-sweep text-sm font-medium transition-colors duration-300',
                active === l.id ? 'text-white' : 'text-stone-300 hover:text-white',
              ].join(' ')}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="btn hidden border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:border-clay-300/60 hover:bg-white/15 sm:inline-flex"
          >
            Staff portal
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn h-10 w-10 border border-white/20 bg-white/5 p-0 text-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Reading progress hairline */}
      <div
        className="h-px w-full origin-left bg-clay-400/80 transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />

      <div
        id="mobile-nav"
        className={[
          'overflow-hidden border-t border-white/5 transition-all duration-500 ease-editorial lg:hidden',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <ul className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b border-white/5 py-3 text-sm text-stone-200 last:border-0 hover:text-white"
              >
                {l.label}
                <span className="kicker text-[9px] text-stone-500">{String(NAV_LINKS.indexOf(l) + 1).padStart(2, '0')}</span>
              </a>
            </li>
          ))}
          <li className="pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="btn w-full border border-clay-400/40 bg-clay-400/10 text-clay-100"
            >
              Staff portal
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
