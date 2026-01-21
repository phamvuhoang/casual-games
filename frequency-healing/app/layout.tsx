import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, IBM_Plex_Sans } from 'next/font/google';
import '@/app/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display'
});

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body'
});

export const metadata: Metadata = {
  title: 'Frequency Healing Studio',
  description: 'Create, explore, and share healing frequency soundscapes.'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen">
        <div className="relative min-h-screen">
          <Header />
          <main className="px-6 pb-20 pt-24 md:px-10">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
