import type { Metadata, Viewport } from 'next';
/* Self-hosted variable fonts (OFL). Bundled by Next, so the browser never
   calls a third-party font CDN — better for privacy, CSP and offline deploys. */
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/fraunces/opsz.css';
// Landing-page display face (eatnaked.co-style grotesk); files load only where used.
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/inter-tight/wght-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Chalar Farms — Inventory & Farm Management Portal',
    template: '%s · Chalar Farms ERP',
  },
  description:
    'Chalar Farms Limited integrated farm ERP: inventory, packhouse, quality assurance, HR, payroll, procurement, sales, export logistics and private internal communications.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0d2117',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
