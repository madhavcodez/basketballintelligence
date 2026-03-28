import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, Syne, JetBrains_Mono } from 'next/font/google';
import AppShell from '@/components/layout/AppShell';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  display: 'swap',
  weight: ['700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
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
  themeColor: '#FAFAFA',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${syne.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col font-body bg-bg-base text-text-primary">
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
