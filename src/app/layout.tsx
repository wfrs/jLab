import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppNav } from '@/components/ui/AppNav';
import './globals.css';

// Linear design language: Inter is the documented open substitute for the
// proprietary Linear Display/Text families (see design-taste-frontend skill)
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'jlab - Plasmid Management',
  description: 'Modern plasmid and GMO management application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Dark-only UI: the `dark` class is pinned so every dark: variant applies
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
