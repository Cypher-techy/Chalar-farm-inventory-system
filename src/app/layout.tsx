import type { Metadata } from 'next';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
