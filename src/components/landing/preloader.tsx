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
      {/* Concentric rings radiating from the mark (eatnaked.co intro) */}
      <div className="preloader-rings">
        <span className="preloader-ring" style={{ '--r': '300px' } as React.CSSProperties} />
        <span className="preloader-ring is-dashed" style={{ '--r': '560px' } as React.CSSProperties} />
        <span className="preloader-ring" style={{ '--r': '820px' } as React.CSSProperties} />
        <span className="preloader-ring is-dashed is-slow" style={{ '--r': '1120px' } as React.CSSProperties} />
        <span className="preloader-ring" style={{ '--r': '1500px' } as React.CSSProperties} />
      </div>

      <div className="preloader-inner">
        {/* Dimmed silhouette with the full-colour mark filling up from the base */}
        <div className="relative">
          <LogoMark variant="compact" size={170} priority decorative className="preloader-ghost" />
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(${100 - count}% 0 0 0)` }}
          >
            <LogoMark variant="compact" size={170} decorative />
          </div>
        </div>
        <p className="preloader-count tnum">{count}%</p>
      </div>
    </div>
  );
}
