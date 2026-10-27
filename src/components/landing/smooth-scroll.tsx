'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/**
 * Inertial smooth scrolling (Lenis) for the public landing page — the
 * weighted, eased scroll feel used by eatnaked.co and similar award sites.
 *
 * - Disabled entirely under prefers-reduced-motion (native scrolling).
 * - In-page anchor links are animated and offset for the fixed header.
 * - Any element with `data-lenis-prevent` keeps native scrolling.
 * - Native scroll events still fire, so every IntersectionObserver / scroll
 *   hook on the page keeps working unchanged.
 */
export function SmoothScroll() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: { offset: -72 },
      autoRaf: true,
    });

    const onChange = () => {
      if (mq.matches) lenis.destroy();
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      lenis.destroy();
    };
  }, []);

  return null;
}
