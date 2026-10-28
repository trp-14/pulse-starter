import type { Metadata, Viewport } from 'next';
import { Nunito_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { Sky } from '@/components/ui/Sky';
import { getServerTheme } from '@/lib/server/theme';
import './globals.css';

// Self-hosted at build time by next/font: no runtime request to Google, so CSP stays font-src 'self'.
const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Pulse · Live Control Room',
  description: 'Live operations dashboard for an online store: revenue, orders, stock and a live order feed.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4fb8ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1c3a' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = await getServerTheme();
  return (
    <html lang="en" data-theme={theme ?? undefined} className={nunitoSans.variable}>
      <body>
        <a className="skip-link" href="#dashboard">
          Skip to dashboard
        </a>
        <div className="app">
          <Sky />
          <div className="shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
