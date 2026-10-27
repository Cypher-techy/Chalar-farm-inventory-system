'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Hand, Mail, MapPin, Phone } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { COMPANY, PHYSICS_TAGS } from './content';

const TAG_STYLES = [
  'bg-clay-400 text-chalar-950',
  'bg-white text-chalar-950',
  'bg-leaf-500 text-white',
  'bg-rust-500 text-white',
  'bg-cream-200 text-rust-700',
  'border border-white/25 bg-white/5 text-white',
];

/**
 * Draggable physics tags (matter.js) — eatnaked.co's falling-word pile.
 * DOM pills are positioned from rigid bodies each frame, so text stays crisp
 * and selectable by screen readers. Mouse users can grab and throw; on touch
 * devices the tags still tumble in but never trap the page scroll. Under
 * reduced motion the tags render as a simple static cloud.
 */
function PhysicsTags() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const tagRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [mode, setMode] = useState<'static' | 'physics'>('static');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) setMode('physics');
  }, []);

  useEffect(() => {
    if (mode !== 'physics') return;
    const box = boxRef.current;
    if (!box) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    let started = false;

    const start = async () => {
      if (started) return;
      started = true;
      const Matter = (await import('matter-js')).default;
      if (disposed) return;
      const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body } = Matter;

      const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0011 } });
      const runner = Runner.create();
      const W = box.clientWidth;
      const H = box.clientHeight;
      const wall = { isStatic: true, render: { visible: false } };
      const T = 200;
      Composite.add(engine.world, [
        Bodies.rectangle(W / 2, H + T / 2, W * 3, T, wall),
        Bodies.rectangle(-T / 2, H / 2, T, H * 4, wall),
        Bodies.rectangle(W + T / 2, H / 2, T, H * 4, wall),
      ]);

      const bodies = tagRefs.current.map((el, i) => {
        if (!el) return null;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const x = Math.min(W - w / 2, Math.max(w / 2, (W * ((i * 37) % 100)) / 100));
        const y = -60 - i * 70 - Math.random() * 40;
        const body = Bodies.rectangle(x, y, w, h, {
          chamfer: { radius: h / 2 },
          restitution: 0.35,
          friction: 0.25,
          frictionAir: 0.012,
          density: 0.002,
          angle: (Math.random() - 0.5) * 0.9,
        });
        Composite.add(engine.world, body);
        return { body, el, w, h };
      });

      const isFinePointer = window.matchMedia('(pointer: fine)').matches;
      let mouseConstraint: Matter.MouseConstraint | null = null;
      let releaseMouse: (() => void) | undefined;
      if (isFinePointer) {
        const mouse = Mouse.create(box);
        // Matter's mouse hijacks the wheel — give scrolling back to the page.
        // Its touch handlers call preventDefault — drop them so touch never traps scrolling.
        const m = mouse as unknown as Record<'mousewheel' | 'mousemove' | 'mousedown' | 'mouseup', EventListener>;
        box.removeEventListener('wheel', m.mousewheel);
        box.removeEventListener('touchmove', m.mousemove);
        box.removeEventListener('touchstart', m.mousedown);
        box.removeEventListener('touchend', m.mouseup);
        // Releasing outside the box must still drop the tag.
        window.addEventListener('mouseup', m.mouseup);
        releaseMouse = () => {
          window.removeEventListener('mouseup', m.mouseup);
          box.removeEventListener('mousemove', m.mousemove);
          box.removeEventListener('mousedown', m.mousedown);
          box.removeEventListener('mouseup', m.mouseup);
        };
        mouseConstraint = MouseConstraint.create(engine, {
          mouse,
          constraint: { stiffness: 0.18, damping: 0.12, render: { visible: false } },
        });
        Composite.add(engine.world, mouseConstraint);
        Events.on(mouseConstraint, 'startdrag', () => box.classList.add('is-grabbing'));
        Events.on(mouseConstraint, 'enddrag', () => box.classList.remove('is-grabbing'));
      }

      Events.on(engine, 'afterUpdate', () => {
        for (const item of bodies) {
          if (!item) continue;
          const { body, el, w, h } = item;
          // Rescue anything flung out of the box.
          if (body.position.y > H + 300 || body.position.x < -300 || body.position.x > W + 300) {
            Body.setPosition(body, { x: W / 2, y: -80 });
            Body.setVelocity(body, { x: 0, y: 0 });
          }
          el.style.transform = `translate3d(${(body.position.x - w / 2).toFixed(1)}px, ${(body.position.y - h / 2).toFixed(1)}px, 0) rotate(${body.angle.toFixed(3)}rad)`;
        }
      });

      Runner.run(runner, engine);
      box.dataset.ready = 'true';

      // Pause the simulation while the section is off-screen.
      const io = new IntersectionObserver(([entry]) => {
        runner.enabled = entry.isIntersecting;
      });
      io.observe(box);

      cleanup = () => {
        io.disconnect();
        Runner.stop(runner);
        releaseMouse?.();
        box.classList.remove('is-grabbing');
        if (mouseConstraint) Composite.remove(engine.world, mouseConstraint);
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      };
    };

    // Drop the tags the first time the box scrolls into view.
    const trigger = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trigger.disconnect();
          start();
        }
      },
      { threshold: 0.35 }
    );
    trigger.observe(box);

    // Rebuild on width change so walls match the new box.
    let lastW = box.clientWidth;
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - lastW) < 40 || !started) return;
      lastW = box.clientWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cleanup?.();
        cleanup = undefined;
        started = false;
        start();
      }, 250);
    });
    ro.observe(box);

    return () => {
      disposed = true;
      trigger.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      cleanup?.();
    };
  }, [mode]);

  if (mode === 'static') {
    return (
      <div className="flex flex-wrap content-end gap-2.5 py-6">
        {PHYSICS_TAGS.map((tag, i) => (
          <span key={tag} className={`rounded-full px-5 py-2.5 text-base font-semibold ${TAG_STYLES[i % TAG_STYLES.length]}`}>
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className="physics-box relative h-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] sm:h-[420px]"
      aria-label="Chalar Farms in a few words"
    >
      <span className="kicker pointer-events-none absolute left-5 top-5 flex items-center gap-2 text-[9px] text-stone-400">
        <Hand className="h-3.5 w-3.5" aria-hidden />
        Drag
      </span>
      {PHYSICS_TAGS.map((tag, i) => (
        <span
          key={tag}
          ref={(el) => {
            tagRefs.current[i] = el;
          }}
          className={`physics-tag absolute left-0 top-0 whitespace-nowrap rounded-full px-5 py-2.5 text-base font-semibold shadow-lift sm:px-6 sm:py-3 sm:text-lg ${TAG_STYLES[i % TAG_STYLES.length]}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function Join() {
  return (
    <section id="contact" className="grain relative overflow-hidden bg-[#070d09] py-24 text-white lg:py-32">
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/images/chalar/culinary-herb-garden.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.14]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(77,167,69,0.18),transparent_50%),radial-gradient(ellipse_at_10%_90%,rgba(148,63,40,0.3),transparent_55%)]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <div className="reveal flex items-center gap-3">
            <LogoMark variant="compact" size={48} decorative />
            <p className="kicker text-clay-300">Export enquiries</p>
          </div>
          <h2 className="mask-lines display display-xl mt-6">
            <span className="mask-line">
              <span>Ready to source</span>
            </span>
            <span className="mask-line">
              <span>
                from <span className="text-clay-300">Chalar?</span>
              </span>
            </span>
          </h2>
          <p className="reveal lede mt-6 max-w-lg text-stone-300">
            Retail programmes, distributor volumes and specification questions go straight to the
            Taveta team. Staff and department managers sign in to the ERP portal.
          </p>
          <div className="reveal mt-9 flex flex-wrap gap-3">
            <a
              href={COMPANY.emailHref}
              className="btn rounded-full bg-clay-400 px-6 py-3 text-base font-semibold text-chalar-950 shadow-lift hover:bg-clay-300"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {COMPANY.email}
            </a>
            <a
              href={COMPANY.phoneHref}
              className="btn rounded-full border border-white/20 bg-white/[0.06] px-6 py-3 text-base font-semibold text-white backdrop-blur hover:border-white/40 hover:bg-white/10"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {COMPANY.phone}
            </a>
            <Link href="/login" className="btn rounded-full px-5 py-3 text-base font-semibold text-clay-200 hover:text-white">
              Staff portal
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="reveal mt-10 flex items-start gap-2.5 text-sm text-stone-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clay-400" aria-hidden />
            {COMPANY.location}
          </p>
        </div>

        <div className="reveal">
          <PhysicsTags />
        </div>
      </div>
    </section>
  );
}
