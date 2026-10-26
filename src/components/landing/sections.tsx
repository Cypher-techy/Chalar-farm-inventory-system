'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Leaf,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import { CustomerMarquee } from './marquee';
import { NAV_LINKS } from './site-header';
import { CERTIFICATIONS, COLD_CHAIN_SPECS, COMPANY } from './content';

export function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-white py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div className="reveal">
          <p className="kicker flex items-center gap-2.5 text-clay-600">
            <span className="h-px w-8 bg-clay-400/70" aria-hidden />
            About {COMPANY.name}
          </p>
          <h2 className="display display-lg mt-5 text-stone-900">
            A certified grower of premium herbs, rooted in Taveta
          </h2>
          <div className="mt-6 space-y-5 leading-relaxed text-stone-600">
            <p>
              Chalar Farms Limited has been operating since {COMPANY.established}, producing and
              exporting over 12 tonnes of fresh herbs every week. Production is centred at Madulu A
              Village, Chala Ward, Taveta — beside Lake Chala on the Kenya–Tanzania border.
            </p>
            <p>
              Around 150 people grow, handle and export the crop, 70% of them women and 75% youth.
              Their work is coordinated through the Chalar Farms ERP: planting, harvest, packhouse,
              quality, payroll, procurement, sales and logistics in one traceable record.
            </p>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {CERTIFICATIONS.map((c) => (
              <li
                key={c.code}
                className="group flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3 transition-all duration-500 ease-editorial hover:-translate-y-0.5 hover:border-chalar-200 hover:bg-white hover:shadow-card"
              >
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-chalar-600 transition-transform duration-500 ease-editorial group-hover:scale-110"
                  aria-hidden
                />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-stone-900">{c.code}</span>
                  <span className="mt-0.5 block text-xs text-stone-500">{c.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal-image relative">
          <span
            className="absolute -right-4 -top-4 hidden h-32 w-32 rounded-2xl border border-clay-200 bg-clay-50 lg:block"
            aria-hidden
          />
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lift sm:aspect-[5/5]">
            <Image
              src="/images/chalar/chalar-cold-chain-truck.jpg"
              alt="Chalar Farms branded refrigerated delivery truck at the Taveta packhouse"
              fill
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover transition-transform duration-[1.4s] ease-editorial hover:scale-[1.04]"
            />
          </div>
          <div className="absolute -bottom-6 left-4 right-4 rounded-2xl border border-white/12 bg-chalar-950/90 p-5 shadow-lift backdrop-blur-md sm:left-8 sm:right-auto sm:w-80">
            <p className="kicker text-[9px] text-clay-300">Our people</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-serif text-lg font-semibold text-white tnum">
              <span>150+ team</span>
              <span className="text-stone-400">·</span>
              <span>70% women</span>
              <span className="text-stone-400">·</span>
              <span>75% youth</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Quality() {
  return (
    <section id="quality" className="relative bg-stone-100 py-24 lg:py-32">
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
            <p className="kicker flex items-center gap-2.5 text-clay-600">
              <span className="h-px w-8 bg-clay-400/70" aria-hidden />
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
              className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-card transition-all duration-500 ease-editorial hover:-translate-y-1 hover:shadow-lift"
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

export function Customers() {
  return (
    <section id="customers" className="relative overflow-hidden bg-white py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="reveal max-w-2xl">
          <p className="kicker flex items-center gap-2.5 text-clay-600">
            <span className="h-px w-8 bg-clay-400/70" aria-hidden />
            Reputable buyers
          </p>
          <h2 className="display display-lg mt-5 text-stone-900">
            Ten customers who buy the same way: on specification, every week
          </h2>
          <p className="lede mt-5">
            Chalar Farms supplies herb buyers and distributors across the United Kingdom, the
            European Union, Southern Africa and the Middle East. Double-cut chives are supplied
            through our sister farm, {COMPANY.sisterFarm}.
          </p>
        </div>
      </div>

      <div className="reveal mt-12">
        <CustomerMarquee />
      </div>

      <p className="mx-auto mt-8 max-w-7xl px-4 text-xs text-stone-400 sm:px-6">
        Customer names and markets as published by Chalar Farms. Shown as typographic wordmarks —
        third-party logos are not reproduced here.
      </p>
    </section>
  );
}

export function ContactCta() {
  return (
    <section id="contact" className="grain relative overflow-hidden bg-chalar-950 py-28 text-white lg:py-36">
      <div className="absolute inset-0">
        <Image
          src="/images/chalar/culinary-herb-garden.jpg"
          alt="Culinary herb garden beds at Chalar Farms"
          fill
          sizes="100vw"
          className="ken-burns object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chalar-950 via-chalar-950/85 to-chalar-950/70" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="reveal max-w-3xl">
          <p className="kicker flex items-center gap-2.5 text-clay-300">
            <span className="h-px w-8 bg-clay-400/70" aria-hidden />
            Export enquiries
          </p>
          <h2 className="display display-xl mt-6">Let&rsquo;s talk herbs.</h2>
          <p className="lede mt-6 text-stone-200">
            Retail programmes, distributor volumes and specification questions go straight to the
            Taveta team. Staff and department managers sign in to the ERP portal.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={COMPANY.emailHref}
              className="btn bg-clay-400 px-6 py-3 text-base font-semibold text-chalar-950 shadow-lift hover:bg-clay-300"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {COMPANY.email}
            </a>
            <a
              href={COMPANY.phoneHref}
              className="btn border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:border-white/45 hover:bg-white/15"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {COMPANY.phone}
            </a>
            <Link
              href="/login"
              className="btn px-6 py-3 text-base font-semibold text-clay-200 hover:text-white"
            >
              Staff portal
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="stagger mt-16 grid gap-6 border-t border-white/15 pt-8 sm:grid-cols-3">
          <div>
            <MapPin className="h-4 w-4 text-clay-400" aria-hidden />
            <p className="kicker mt-3 text-[9px] text-clay-300">Farm &amp; packhouse</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">
              {COMPANY.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
          <div>
            <Phone className="h-4 w-4 text-clay-400" aria-hidden />
            <p className="kicker mt-3 text-[9px] text-clay-300">Telephone</p>
            <a href={COMPANY.phoneHref} className="mt-2 block text-sm text-stone-300 hover:text-white">
              {COMPANY.phone}
            </a>
          </div>
          <div>
            <Mail className="h-4 w-4 text-clay-400" aria-hidden />
            <p className="kicker mt-3 text-[9px] text-clay-300">Email</p>
            <a href={COMPANY.emailHref} className="mt-2 block text-sm text-stone-300 hover:text-white">
              {COMPANY.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-chalar-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="reveal">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-chalar-600 text-white">
                <Leaf className="h-5 w-5" aria-hidden />
              </span>
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
