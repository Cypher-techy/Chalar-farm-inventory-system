'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/brand/logo';

const SESSION_KEY = 'chalar-preloader-seen';

/**
 * Runs before first paint (emitted by the server page): skips the preloader
 * for repeat visits in the same session and for reduced-motion users, so it
 * never flashes for them.
 */
export const PRELOADER_BOOT_SCRIPT = `try{var d=document.documentElement;if(sessionStorage.getItem('${SESSION_KEY}')||window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('chalar-preloaded')}}catch(e){}`;

/**
 * Brand intro: the glowing Chalar mark with a 0 → 100 counter, then the
 * curtain lifts. Shown once per browser session, ~1.4 s. A CSS failsafe
 * hides it even if JavaScript never runs, so it can never block the page.
 */
export function Preloader() {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'done'>('loading');

  useEffect(() => {
    if (document.documentElement.classList.contains('chalar-preloaded')) {
      setPhase('done');
      return;
    }
    let raf = 0;
    let leaveTimer = 0;
    const start = performance.now();
    const DURATION = 1250;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        try {
          sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
          /* private mode — fine */
        }
        setPhase('leaving');
        leaveTimer = window.setTimeout(() => {
          document.documentElement.classList.add('chalar-preloaded');
          setPhase('done');
        }, 950);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(leaveTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div className="preloader" data-phase={phase} aria-hidden>
      <div className="preloader-inner">
        <div className="relative">
          <span className="glow-breathe absolute inset-[18%] rounded-full bg-leaf-400/30 blur-3xl" />
          <LogoMark variant="glow" size={220} priority decorative className="relative" />
        </div>
        <p className="mt-2 font-serif text-xl font-semibold tracking-tight text-white">Chalar Farms</p>
        <p className="kicker mt-1 text-[9px] text-clay-300">Growers &amp; Exporters of Fresh Herbs</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-6 sm:px-10 sm:pb-8">
        <span className="kicker text-[10px] text-stone-500">Taveta · Kenya</span>
        <span className="display text-6xl text-white tnum sm:text-8xl">
          {count}
          <span className="text-clay-400">%</span>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10">
        <div
          className="h-px origin-left bg-clay-400"
          style={{ transform: `scaleX(${count / 100})` }}
        />
      </div>
    </div>
  );
}
