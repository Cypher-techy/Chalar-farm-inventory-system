'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone, Snowflake } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { NAV_LINKS } from './site-header';
import { COLD_CHAIN_SPECS, COMPANY } from './content';

export function Quality() {
  return (
    <section id="quality" className="relative bg-cream-200/60 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="reveal-image relative order-2 aspect-[4/3] overflow-hidden rounded-2xl shadow-lift lg:order-1">
            <Image
              src="/images/chalar/packhouse-herb-crates.jpg"
              alt="Freshly harvested herbs in crates at the packhouse awaiting grading and packing"
              fill
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-chalar-950/80 px-3 py-1.5 backdrop-blur-sm">
              <Snowflake className="h-3.5 w-3.5 text-clay-300" aria-hidden />
              <span className="kicker text-[9px] text-white">Cold chain held from the field</span>
            </span>
          </div>

          <div className="reveal order-1 lg:order-2">
            <p className="kicker flex items-center gap-2.5 text-rust-500">
              <span className="h-px w-8 bg-rust-400/60" aria-hidden />
              Quality management
            </p>
            <h2 className="display display-lg mt-5 text-stone-900">
              Food safety and traceability, built into every batch
            </h2>
            <div className="mt-6 space-y-5 leading-relaxed text-stone-600">
              <p>
                Packhouse, grading and cold-room facilities are built to international health and
                safety standards. Harvest batches carry unique identifiers through intake,
                inspection, packing and dispatch, with quarantine and release decisions recorded
                against the responsible officer.
              </p>
              <p>
                Export documentation — phytosanitary certificates, EUR.1 movement certificates,
                packing lists, commercial invoices and airwaybills — stays linked to the correct
                order, customer, product and batch. Certificate numbers are recorded only when the
                issuing authority provides them.
              </p>
            </div>
          </div>
        </div>

        <div className="stagger mt-16 grid gap-5 sm:grid-cols-3">
          {COLD_CHAIN_SPECS.map((spec) => (
            <article
              key={spec.label}
              className="group relative overflow-hidden rounded-3xl border border-cream-300 bg-white p-6 shadow-card transition-all duration-500 ease-editorial hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-clay-400 transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
              <p className="kicker text-[10px] text-stone-500">{spec.label}</p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="display text-4xl text-stone-900 tnum">{spec.figure}</span>
                <span className="font-serif text-lg font-semibold text-clay-500">{spec.unit}</span>
              </p>
              <p className="mt-2 text-sm text-stone-500">{spec.detail}</p>
              {spec.second && (
                <p className="mt-4 flex items-baseline gap-2 border-t border-stone-100 pt-4">
                  <span className="display text-2xl text-stone-700 tnum">{spec.second.figure}</span>
                  <span className="text-sm font-medium text-clay-500">{spec.second.unit}</span>
                  <span className="ml-auto text-xs text-stone-400">{spec.second.detail}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#070d09] text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="reveal">
            <div className="flex items-center gap-3">
              <LogoMark variant="compact" size={44} decorative />
              <span className="font-serif text-xl font-semibold tracking-tight text-white">
                {COMPANY.name}
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-stone-400">
              Growers and exporters of premium fresh herbs from Taita-Taveta, Kenya. Farm
              operations, inventory, quality, people and finance run on the Chalar Farms ERP &amp;
              Inventory Portal.
            </p>
          </div>

          <div className="reveal">
            <h3 className="kicker text-[10px] text-clay-300">Explore</h3>
            <ul className="mt-5 space-y-2.5 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="link-sweep inline-block text-stone-400 hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal">
            <h3 className="kicker text-[10px] text-clay-300">Portal</h3>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <Link href="/login" className="link-sweep inline-block text-stone-400 hover:text-white">
                  Staff sign in
                </Link>
              </li>
              <li>
                <Link href="/login" className="link-sweep inline-block text-stone-400 hover:text-white">
                  Department dashboards
                </Link>
              </li>
              <li>
                <span className="text-stone-500">Role-based access, audited</span>
              </li>
            </ul>
          </div>

          <div className="reveal">
            <h3 className="kicker text-[10px] text-clay-300">Contact</h3>
            <ul className="mt-5 space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clay-400" aria-hidden />
                <span>{COMPANY.location}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-clay-400" aria-hidden />
                <a href={COMPANY.phoneHref} className="hover:text-white">
                  {COMPANY.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-clay-400" aria-hidden />
                <a href={COMPANY.emailHref} className="hover:text-white">
                  {COMPANY.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-6 text-xs leading-relaxed text-stone-500">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p>
              © {new Date().getFullYear()} {COMPANY.name}. All rights reserved. Product imagery
              © Chalar Farms and partners.
            </p>
            <p className="max-w-xl sm:text-right">
              Certification claims reflect publicly listed company information — verify current
              certificate validity with the issuing bodies before external reliance.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
