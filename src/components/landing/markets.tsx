'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, MoveHorizontal, Snowflake } from 'lucide-react';
import { MARKETS } from './content';

const SPEED_PX_PER_SEC = 34;

/**
 * Endless, draggable market carousel. The card list is rendered twice and the
 * track's offset wraps at half its width, so it loops seamlessly. It drifts on
 * its own, follows the pointer while dragged (with release momentum), pauses
 * on hover/focus and when off-screen, and stays still under reduced motion.
 */
export function Markets() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const s = useRef({
    x: 0,
    half: 1,
    velocity: 0,
    paused: false,
    visible: true,
    reduced: false,
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    moved: 0,
    target: null as number | null,
  });

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;
    const st = s.current;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    st.reduced = mq.matches;

    const measure = () => {
      st.half = track.scrollWidth / 2 || 1;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    const io = new IntersectionObserver(([entry]) => {
      st.visible = entry.isIntersecting;
    });
    io.observe(viewport);

    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (st.visible && !st.dragging) {
        if (st.target !== null) {
          const diff = st.target - st.x;
          st.x += diff * Math.min(1, dt * 9);
          if (Math.abs(diff) < 0.5) st.target = null;
        } else if (Math.abs(st.velocity) > 5) {
          st.x += st.velocity * dt;
          st.velocity *= Math.pow(0.04, dt); // momentum decay
        } else if (!st.paused && !st.reduced) {
          st.x -= SPEED_PX_PER_SEC * dt;
        }
      }
      // wrap into (-half, 0]
      if (st.x <= -st.half) {
        st.x += st.half;
        if (st.target !== null) st.target += st.half;
      }
      if (st.x > 0) {
        st.x -= st.half;
        if (st.target !== null) st.target -= st.half;
      }
      track.style.transform = `translate3d(${st.x.toFixed(2)}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMq = () => {
      st.reduced = mq.matches;
    };
    mq.addEventListener('change', onMq);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener('change', onMq);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const st = s.current;
    st.dragging = true;
    st.pointerId = e.pointerId;
    st.lastX = e.clientX;
    st.lastT = performance.now();
    st.velocity = 0;
    st.moved = 0;
    st.target = null;
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (!st.dragging || e.pointerId !== st.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - st.lastX;
    st.x += dx;
    st.moved += Math.abs(dx);
    const dt = Math.max(1, now - st.lastT) / 1000;
    st.velocity = dx / dt;
    st.lastX = e.clientX;
    st.lastT = now;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (e.pointerId !== st.pointerId) return;
    st.dragging = false;
    st.pointerId = -1;
    if (performance.now() - st.lastT > 80) st.velocity = 0;
    st.velocity = Math.max(-2400, Math.min(2400, st.velocity));
    setDragging(false);
  };

  const nudge = (dir: 1 | -1) => {
    const st = s.current;
    const card = trackRef.current?.querySelector<HTMLElement>('[data-market-card]');
    const step = card ? card.offsetWidth + 20 : 360;
    st.velocity = 0;
    st.target = (st.target ?? st.x) - dir * step;
  };

  const cards = (hidden: boolean) =>
    MARKETS.map((m, i) => (
      <article
        key={`${m.code}-${hidden ? 'b' : 'a'}`}
        data-market-card
        aria-hidden={hidden || undefined}
        className="market-card relative mr-5 flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-cream-300 bg-white p-6 shadow-card sm:w-[340px]"
      >
        <span
          className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
            i % 3 === 0 ? 'bg-clay-300/45' : i % 3 === 1 ? 'bg-leaf-300/40' : 'bg-rust-300/35'
          }`}
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="kicker text-[9px] text-stone-400">Market</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-tight text-stone-900">
              {m.region}
            </h3>
          </div>
          <span className="rounded-full bg-chalar-950 px-2.5 py-1 font-mono text-[10px] font-semibold text-clay-200">
            {m.code}
          </span>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-cream-100 p-4">
          <div>
            <p className="text-[11px] text-stone-500">Cold chain</p>
            <p className="display mt-1 text-2xl text-stone-900 tnum">
              2–4<span className="text-base text-clay-500"> °C</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-stone-500">Shelf life</p>
            <p className="display mt-1 text-2xl text-stone-900 tnum">
              ~14<span className="text-base text-clay-500"> days</span>
            </p>
          </div>
        </div>

        <dl className="relative mt-5 space-y-2.5 text-sm">
          {m.buyers.map((b, bi) => (
            <div key={b} className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-2.5 last:border-0">
              <dt className="text-stone-500">{bi === 0 ? 'Buyers' : ''}</dt>
              <dd className="font-semibold text-stone-900">{b}</dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-auto flex items-end justify-between pt-6">
          <span className="flex -space-x-4">
            {m.images.map((src, ii) => (
              <span
                key={src + ii}
                className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-card"
              >
                <Image src={src} alt="" fill sizes="56px" className="object-cover" draggable={false} />
              </span>
            ))}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Snowflake className="h-3.5 w-3.5 text-leaf-600" aria-hidden />
            Basil 8–10 °C
          </span>
        </div>
      </article>
    ));

  return (
    <section id="markets" className="relative overflow-hidden bg-cream-100 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="reveal max-w-2xl">
            <p className="kicker flex items-center gap-2.5 text-rust-500">
              <span className="h-px w-8 bg-rust-400/60" aria-hidden />
              Where we ship
            </p>
            <h2 className="display display-lg mt-5 text-stone-900">Whatever your market.</h2>
            <p className="lede mt-5">
              Same cold chain, same specification, every week — for herb buyers and distributors
              across the UK, Europe, Southern Africa and the Middle East.
            </p>
          </div>
          <div className="reveal flex items-center gap-3">
            <span className="kicker hidden items-center gap-2 text-stone-400 sm:flex">
              <MoveHorizontal className="h-4 w-4" aria-hidden />
              Drag
            </span>
            <button
              type="button"
              onClick={() => nudge(-1)}
              className="btn h-12 w-12 rounded-full border border-stone-300 bg-white p-0 text-stone-700 hover:border-rust-400 hover:text-rust-600"
              aria-label="Previous market"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              className="btn h-12 w-12 rounded-full border border-stone-300 bg-white p-0 text-stone-700 hover:border-rust-400 hover:text-rust-600"
              aria-label="Next market"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`reveal mt-12 touch-pan-y select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={() => (s.current.paused = true)}
        onMouseLeave={() => (s.current.paused = false)}
        onFocus={() => (s.current.paused = true)}
        onBlur={() => (s.current.paused = false)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Export markets and buyers"
      >
        <div ref={trackRef} className="flex w-max py-2 pl-4 will-change-transform sm:pl-6">
          {cards(false)}
          {cards(true)}
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-7xl px-4 text-xs text-stone-400 sm:px-6">
        Markets and buyer names as published by Chalar Farms, shown as text — third-party logos are
        not reproduced.
      </p>
    </section>
  );
}
