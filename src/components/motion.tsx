'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reusable scroll-reveal + count-up animation utilities for the
 * Chalar Farms public landing page and KPI components.
 * Respects prefers-reduced-motion automatically via CSS fallbacks.
 */

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const targets = node.querySelectorAll<HTMLElement>('.reveal, .reveal-image, .stagger');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** Animates a numeric KPI from 0 to `value` when it first enters the viewport. */
export function useCountUp(value: number, durationMs = 900): {
  displayValue: number;
  ref: React.RefObject<HTMLSpanElement | null>;
} {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplayValue(value);
      return;
    }
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayValue(value * eased);
          if (t < 1) raf = requestAnimationFrame(step);
          else setDisplayValue(value);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs, reduced]);

  return { displayValue, ref };
}
