'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reusable scroll-reveal, parallax and drag utilities for the Chalar Farms
 * public landing page and KPI components.
 *
 * Every effect degrades gracefully:
 *  - no IntersectionObserver  → content is shown immediately
 *  - prefers-reduced-motion   → CSS disables the animation, hooks skip rAF work
 */

const REVEAL_SELECTOR = '.reveal, .reveal-image, .reveal-rule, .stagger, .mask-lines';

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

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const targets = node.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);
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

/** Document scroll progress, 0 → 1. Used for the header reading-progress hairline. */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return progress;
}

/** Tracks which in-page section is currently in view, for active nav state. */
export function useActiveSection(ids: string[], offsetPx = 140): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      let current: string | null = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top - offsetPx <= 0) {
          current = section.id;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids, offsetPx]);

  return active;
}

/**
 * Scroll + pointer parallax. Returns a ref for the host element and a style
 * object with a GPU-friendly translate3d. `depth` is the scroll factor
 * (positive = moves slower/behind, negative = drifts against the scroll).
 */
export function useParallax(depth = 0.12, pointerDepth = 10) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (reduced) {
      setStyle({});
      return;
    }
    let raf = 0;
    let px = 0;
    let py = 0;

    const compute = () => {
      raf = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 (below viewport) → 1 (above viewport)
      const rel = (rect.top + rect.height / 2 - vh / 2) / vh;
      const y = rel * depth * -100;
      setStyle({
        transform: `translate3d(${px * pointerDepth}px, ${y + py * pointerDepth}px, 0)`,
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
      py = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [depth, pointerDepth, reduced]);

  return { ref, style };
}

/** Which entries of a list are in view (index → boolean), for sticky rails. */
export function useInViewFlags<T extends HTMLElement = HTMLLIElement>(count: number) {
  const refs = useRef<Array<T | null>>([]);
  const [flags, setFlags] = useState<boolean[]>(() => Array(count).fill(false));

  // Per-index ref callbacks are cached so React does not detach/reattach on every render.
  const callbacks = useRef<Array<(node: T | null) => void>>([]);
  const setRef = useCallback((index: number) => {
    if (!callbacks.current[index]) {
      callbacks.current[index] = (node: T | null) => {
        refs.current[index] = node;
      };
    }
    return callbacks.current[index];
  }, []);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setFlags(Array(count).fill(true));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setFlags((prev) => {
          const next = [...prev];
          let changed = false;
          for (const entry of entries) {
            const idx = Number((entry.target as HTMLElement).dataset.index ?? -1);
            if (idx >= 0 && next[idx] !== entry.isIntersecting) {
              next[idx] = entry.isIntersecting;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { threshold: 0.55, rootMargin: '-20% 0px -30% 0px' }
    );
    refs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [count]);

  return { flags, setRef };
}

/**
 * Drag-to-scroll for horizontal rails. Returns props for the scroll container
 * plus `isDragging` and helpers to nudge by one card width.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const state = useRef({ pointerId: -1, startX: 0, startScroll: 0, moved: 0 });

  const onPointerDown = (e: React.PointerEvent<T>) => {
    if (e.button !== 0) return;
    const node = ref.current;
    if (!node) return;
    state.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: node.scrollLeft,
      moved: 0,
    };
    setIsDragging(true);
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
  };

  const onPointerMove = (e: React.PointerEvent<T>) => {
    if (!isDragging || e.pointerId !== state.current.pointerId) return;
    const node = ref.current;
    if (!node) return;
    const dx = e.clientX - state.current.startX;
    state.current.moved = Math.max(state.current.moved, Math.abs(dx));
    node.scrollLeft = state.current.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent<T>) => {
    if (e.pointerId !== state.current.pointerId) return;
    const node = ref.current;
    setIsDragging(false);
    if (node?.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
    state.current.pointerId = -1;
  };

  const onClickCapture = (e: React.MouseEvent<T>) => {
    // Suppress the click that follows a real drag gesture.
    if (state.current.moved > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
    state.current.moved = 0;
  };

  const nudge = (direction: 1 | -1) => {
    const node = ref.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>('[data-rail-card]');
    const step = card ? card.offsetWidth + 16 : node.clientWidth * 0.8;
    node.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return {
    ref,
    isDragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
    nudge,
  };
}
