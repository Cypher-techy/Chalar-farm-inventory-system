'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Leaf,
  Snowflake,
  ShieldCheck,
  Ship,
  Users,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { useScrollReveal, useCountUp } from '@/components/motion';

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#operations', label: 'Operations' },
  { href: '#herbs', label: 'Our Herbs' },
  { href: '#quality', label: 'Quality & Export' },
  { href: '#contact', label: 'Contact' },
];

const HERBS = [
  { name: 'Basil', note: 'Average 6 tonnes per week', image: '/images/chalar/greenhouse-sweet-basil.jpg' },
  { name: 'Thyme', note: 'About 300 kg every week', image: '/images/chalar/rosemary-blossom.jpg' },
  { name: 'Rosemary', note: 'Capacity of 300+ kg per week', image: '/images/chalar/drip-irrigated-rosemary.jpg' },
  { name: 'Chives', note: 'About 1 tonne of double-cut chives weekly', image: '/images/chalar/fresh-herb-bundle.jpg' },
  { name: 'Tarragon', note: '250 kg of tarragon per week', image: '/images/chalar/culinary-herb-garden.jpg' },
  { name: 'Lemongrass', note: 'About 1 tonne per week', image: '/images/chalar/farm-aerial-taveta.jpg' },
  { name: 'Sage', note: 'Over 1 tonne during peak season', image: '/images/chalar/farm-fields-greenhouses.jpg' },
  { name: 'Oregano', note: '200 kg of oregano every week', image: '/images/chalar/packhouse-herb-crates.jpg' },
];

function HeroStat({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { displayValue, ref } = useCountUp(value, 1100);
  return (
    <div className="text-center sm:text-left">
      <span
        ref={ref}
        className="block text-3xl font-serif font-bold text-white sm:text-4xl tabular-nums"
      >
        {Math.round(displayValue).toLocaleString('en-KE')}
        {suffix}
      </span>
      <span className="mt-1 block text-xs uppercase tracking-widest text-emerald-200/90">
        {label}
      </span>
    </div>
  );
}

export default function LandingPage() {
  const rootRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={rootRef} className="bg-white text-stone-800">
      {/* ============ TOP NAVIGATION ============ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-chalar-950/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-chalar-600 text-white">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-lg font-bold text-white">Chalar Farms</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                Growers &amp; Exporters of Fresh Herbs
              </span>
            </span>
          </Link>
          <div className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-stone-200 transition-colors hover:text-emerald-300"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="btn border border-emerald-400/40 bg-transparent text-sm text-emerald-100 hover:bg-emerald-400/10"
            >
              Staff Portal
            </Link>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[92vh] items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/chalar/farm-fields-greenhouses.jpg"
            alt="Chalar Farms herb fields and greenhouses under a bright Taita-Taveta sky"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-chalar-950 via-chalar-950/55 to-chalar-950/25" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6">
          <div className="reveal max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-950/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Taita-Taveta County · Kenya · Est. 2015
            </p>
            <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Consistent quality,
              <br />
              reliable supply — all year round.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-200">
              Chalar Farms grows, packs and exports premium fresh herbs to customers across the
              European Union, the United Kingdom and the Middle East — supported by an integrated
              farm management portal that keeps every batch traceable from field to flight.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#herbs" className="btn bg-emerald-500 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-600">
                Explore Our Herbs
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                href="/login"
                className="btn border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                Open ERP Portal
              </Link>
            </div>
          </div>

          <div className="stagger mt-14 grid grid-cols-2 gap-6 border-t border-white/15 pt-8 sm:grid-cols-4">
            <HeroStat value={12} suffix="+" label="Tonnes exported weekly" />
            <HeroStat value={150} suffix="+" label="Trained team members" />
            <HeroStat value={70} suffix="%" label="Female workforce" />
            <HeroStat value={9} label="Years of operation" />
          </div>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="reveal">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-chalar-600">About Chalar Farms</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
              A certified grower of premium herbs, rooted in Taveta
            </h2>
            <div className="mt-5 space-y-4 leading-relaxed text-stone-600">
              <p>
                Chalar Farms Limited is a fast-growing farm that has been operating since 2015,
                producing and exporting over 12 tonnes of fresh herbs every week. Our production is
                centred at Madulu A Village, Chala Ward, Taveta, beside the Chala lake at the
                Kenya–Tanzania border.
              </p>
              <p>
                Our customers include some of the top herb buyers and distributors in the world,
                and our team of about 150 people brings extensive experience in growing, handling
                and exporting herbs — with 70% of staff being female and 75% youth.
              </p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                'GLOBALG.A.P. certified growing',
                'GRASP social practice certified',
                'SMETA ethical trade audited',
                'LEAF Marque environmental assurance',
              ].map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-chalar-600" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal-image relative aspect-[4/3] overflow-hidden rounded-xl shadow-xl">
            <Image
              src="/images/chalar/chalar-cold-chain-truck.jpg"
              alt="Chalar Farms branded refrigerated delivery truck at the Taveta packhouse"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* ============ OPERATIONS ============ */}
      <section id="operations" className="bg-chalar-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="reveal max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Farm to Flight</p>
            <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
              An unbroken cold chain, from field block to airwaybill
            </h2>
            <p className="mt-4 text-stone-300">
              Every operational step — planting, harvest, intake, grading, packing, quality release
              and dispatch — is recorded in the Chalar Farms ERP so that any carton can be traced
              back to the exact field, cycle and harvest batch that produced it.
            </p>
          </div>

          <div className="stagger mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Leaf,
                title: 'Precision Growing',
                body: 'Greenhouse and open-field blocks under drip irrigation, with logged input applications, pest scouting and harvest scheduling.',
              },
              {
                icon: Snowflake,
                title: 'Cold Chain Integrity',
                body: 'Field heat removed within minutes of cutting; cold rooms held at 2–4 °C with continuous monitoring before pre-cooling for airfreight.',
              },
              {
                icon: ShieldCheck,
                title: 'Quality & Food Safety',
                body: 'Incoming, in-process and finished-product inspections with quarantine, CAPA and release authority recorded against every batch.',
              },
              {
                icon: Ship,
                title: 'Export Logistics',
                body: 'Refrigerated trucks from Taveta to JKIA, phytosanitary documentation, EUR.1 certificates and airline handover tracked to delivery.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-white/10 bg-white/5 p-6 transition-colors hover:border-emerald-400/40 hover:bg-white/[0.07]">
                <f.icon className="h-7 w-7 text-emerald-400" aria-hidden />
                <h3 className="mt-4 font-serif text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-300">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="reveal-image mt-14 overflow-hidden rounded-xl">
            <Image
              src="/images/chalar/farm-aerial-taveta.jpg"
              alt="Aerial view of the Chalar Farms production site near Taveta"
              width={1600}
              height={700}
              className="h-auto w-full object-cover"
              sizes="100vw"
            />
          </div>
        </div>
      </section>

      {/* ============ HERBS ============ */}
      <section id="herbs" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="reveal max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-chalar-600">Our Products</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
            A wide variety of fresh herbs
          </h2>
          <p className="mt-4 text-stone-600">
            Handpicked and expertly packed, our herbs meet global standards for quality, safety and
            taste — trusted by top distributors across Europe, the UK and the Middle East. Weekly
            volumes below reflect figures published by Chalar Farms.
          </p>
        </div>

        <div className="stagger mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HERBS.map((h) => (
            <article
              key={h.name}
              className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={h.image}
                  alt={`${h.name} at Chalar Farms`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-lg font-semibold text-stone-900">{h.name}</h3>
                <p className="mt-1 text-sm text-stone-500">{h.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ QUALITY & EXPORT ============ */}
      <section id="quality" className="bg-stone-100 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div className="reveal-image relative aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
            <Image
              src="/images/chalar/packhouse-herb-crates.jpg"
              alt="Freshly harvested herbs in crates at the packhouse awaiting grading and packing"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="reveal">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-chalar-600">
              Quality Management
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
              Food safety and traceability, built into every batch
            </h2>
            <div className="mt-5 space-y-4 leading-relaxed text-stone-600">
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
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { icon: Snowflake, label: 'Cold chain', value: '2–4 °C' },
                { icon: Users, label: 'Inspection', value: 'Per batch' },
                { icon: Ship, label: 'Markets', value: 'EU · UK · ME' },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-stone-200 bg-white p-4 text-center">
                  <m.icon className="mx-auto h-5 w-5 text-chalar-600" aria-hidden />
                  <p className="mt-2 text-xs uppercase tracking-wide text-stone-500">{m.label}</p>
                  <p className="font-serif text-lg font-bold text-stone-900">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTACT / FOOTER ============ */}
      <footer id="contact" className="bg-chalar-950 text-stone-300">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="reveal">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-chalar-600 text-white">
                  <Leaf className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-serif text-xl font-bold text-white">Chalar Farms Limited</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-400">
                Growers and exporters of premium fresh herbs from Taita-Taveta, Kenya. Integrated
                farm operations managed through the Chalar Farms ERP &amp; Inventory Portal.
              </p>
            </div>
            <div className="reveal">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Contact</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  Madulu A Village, Chala Ward, Taveta Sub-County,
                  <br />
                  Taita-Taveta County, Kenya
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  <a href="tel:+254722944496" className="hover:text-white">+254 722 944 496</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  <a href="mailto:info@chalarfarms.com" className="hover:text-white">info@chalarfarms.com</a>
                </li>
              </ul>
            </div>
            <div className="reveal">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Quick Access</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
                    Staff ERP Portal →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} Chalar Farms Limited. All rights reserved. Product
              images © Chalar Farms and partners.
            </p>
            <p>
              Certification claims reflect publicly listed company information — verify current
              certificate validity with the issuing bodies before external reliance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
