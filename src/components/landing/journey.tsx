'use client';

import { useInViewFlags } from '@/components/motion';
import { JOURNEY } from './content';

/**
 * Sticky two-column scrollytelling: the left column stays put while the seven
 * operational steps scroll past, and the active step drives the progress rail.
 */
export function Journey() {
  const { flags, setRef } = useInViewFlags<HTMLLIElement>(JOURNEY.length);
  const activeIndex = flags.reduce((acc, on, i) => (on ? i : acc), 0);
  const active = JOURNEY[activeIndex];
  const progress = ((activeIndex + 1) / JOURNEY.length) * 100;

  return (
    <section id="journey" className="grain relative overflow-hidden bg-chalar-950 py-24 text-white lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <div className="reveal lg:sticky lg:top-28 lg:self-start">
          <p className="kicker flex items-center gap-2.5 text-clay-300">
            <span className="h-px w-8 bg-clay-400/70" aria-hidden />
            Farm to flight
          </p>
          <h2 className="display display-lg mt-5">
            An unbroken chain, from field block to airwaybill
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-stone-300">
            Seven recorded steps. Each one writes to the ERP, so any carton can be traced back to
            the exact block, cycle and harvest batch that produced it — and forward to the
            customer, flight and document that carried it.
          </p>

          <div className="mt-10 flex items-end gap-4">
            <span className="display text-6xl text-clay-400 tnum">{active.step}</span>
            <span className="pb-2 text-sm text-stone-400 tnum">
              / {String(JOURNEY.length).padStart(2, '0')}
            </span>
          </div>
          <div className="mt-3 h-px w-full bg-white/12" aria-hidden>
            <div
              className="h-px origin-left bg-clay-400 transition-transform duration-700 ease-editorial"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
          <p className="mt-4 font-serif text-lg font-semibold text-white transition-all duration-500">
            {active.title}
          </p>
          <p className="mt-1 font-mono text-[11px] text-clay-300/80">{active.record}</p>
        </div>

        <ol className="journey-rail">
          {JOURNEY.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <li
                key={item.step}
                ref={setRef(i)}
                data-index={i}
                data-active={isActive}
                className="journey-step relative grid grid-cols-[auto_minmax(0,1fr)] gap-5 pb-12 last:pb-0 lg:gap-7"
              >
                <div className="relative flex flex-col items-center">
                  <span
                    className="journey-dot z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-chalar-900 text-[11px] font-semibold text-stone-400 transition-all duration-500 ease-editorial tnum"
                    aria-hidden
                  >
                    {item.step}
                  </span>
                  {i < JOURNEY.length - 1 && (
                    <span className="absolute top-10 h-full w-px bg-white/12" aria-hidden />
                  )}
                </div>
                <div className="pt-1">
                  <h3 className="journey-title font-serif text-xl font-semibold tracking-tight text-stone-200 transition-colors duration-500 sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="journey-body mt-2 max-w-xl text-sm leading-relaxed">{item.body}</p>
                  <p className="mt-3 inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-clay-300/90">
                    {item.record}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
