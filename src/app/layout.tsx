import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import AppShell from '@/components/layout/AppShell';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Basketball Intelligence Playground',
  description:
    'Explore NBA player stats, shot charts, lineup analysis, and basketball intelligence powered by advanced analytics.',
  keywords: [
    'basketball',
    'NBA',
    'analytics',
    'player stats',
    'shot chart',
    'lineup analysis',
  ],
  applicationName: 'Basketball Intelligence',
  openGraph: {
    title: 'Basketball Intelligence Playground',
    description:
      'Explore NBA player stats, shot charts, lineup analysis, and basketball intelligence.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a12',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-dvh flex flex-col font-body bg-dark-base text-chrome-light">
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
