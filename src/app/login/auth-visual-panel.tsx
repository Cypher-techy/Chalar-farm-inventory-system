import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { LogoLockup, LogoMark } from '@/components/brand/logo';

const DEFAULT_BLURB =
  'Role-based access to farm operations, inventory, packhouse, quality assurance, finance, payroll, HR and private internal communications — with every action audited.';

/** Photographic left-hand panel shared by the sign-in and sign-up pages (desktop only). */
export function AuthVisualPanel({
  headline = ['Everything from', 'field to flight.'],
  blurb = DEFAULT_BLURB,
}: {
  headline?: [string, string];
  blurb?: string;
}) {
  return (
      <div className="grain relative hidden w-1/2 shrink-0 self-start overflow-hidden bg-[#070d09] lg:sticky lg:top-0 lg:block lg:h-screen">
        <Image
          src="/images/chalar/greenhouse-sweet-basil.jpg"
          alt="Rows of sweet basil growing under greenhouse cover at Chalar Farms"
          fill
          priority
          sizes="50vw"
          className="ken-burns object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chalar-950 via-chalar-950/65 to-chalar-950/25" />

        <div className="absolute inset-x-0 top-0 p-10">
          <Link href="/" className="group inline-flex items-center" aria-label="Chalar Farms home">
            <LogoLockup tone="dark" size={44} subtitle="ERP & Inventory Portal" priority />
          </Link>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-40" aria-hidden>
          <span className="glow-breathe absolute h-64 w-64 rounded-full bg-leaf-400/25 blur-[70px]" />
          <LogoMark variant="glow" size={340} decorative className="float-soft-slow relative opacity-95" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-10">
          <h1 className="mask-lines display display-lg text-white">
            <span className="mask-line">
              <span>{headline[0]}</span>
            </span>
            <span className="mask-line">
              <span className="text-clay-300">{headline[1]}</span>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-stone-300">{blurb}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-6 text-xs text-stone-300">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-clay-400" aria-hidden />
              Segregation of duties enforced server-side
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-clay-400" aria-hidden />
              12+ tonnes exported weekly
            </span>
          </div>
        </div>
      </div>
  );
}
