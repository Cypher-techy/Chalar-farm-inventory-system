'use client';

import type { ReactNode } from 'react';
import { useScrollReveal } from '@/components/motion';

/** Client root for the landing page: wires IntersectionObserver reveals for every child section. */
export function LandingShell({ children }: { children: ReactNode }) {
  const rootRef = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={rootRef} className="landing bg-cream-100 text-stone-800">
      {children}
    </div>
  );
}
