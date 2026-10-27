'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * Fixed bottom-right "Contact us" tab (eatnaked.co). Slides away while the
 * contact section itself is on screen so it never duplicates the real CTAs.
 */
export function ContactCorner() {
  const [contactInView, setContactInView] = useState(false);
  // On phones the hero has its own CTAs at the bottom — wait until the visitor scrolls past them.
  const [heroClear, setHeroClear] = useState(true);

  useEffect(() => {
    const target = document.getElementById('contact');
    if (!target) return;
    const io = new IntersectionObserver(([entry]) => setContactInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const check = () =>
      setHeroClear(window.innerWidth >= 640 || window.scrollY > window.innerHeight * 0.75);
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const hidden = contactInView || !heroClear;

  return (
    <a
      href="#contact"
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={[
        'fixed bottom-0 right-0 z-40 inline-flex items-center gap-2 rounded-tl-[1.75rem] bg-clay-600 px-5 py-3.5 text-base font-semibold text-white shadow-[0_-8px_40px_-12px_rgba(194,92,61,0.6)] transition-all duration-500 ease-editorial hover:bg-clay-500 sm:px-9 sm:py-5 sm:text-xl',
        hidden ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100',
      ].join(' ')}
    >
      <ArrowUpRight className="h-5 w-5" aria-hidden />
      Contact us
    </a>
  );
}
