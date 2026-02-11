import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, IBM_Plex_Sans } from 'next/font/google';
import '@/app/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BackgroundRoot from '@/components/background/BackgroundRoot';
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  buildOrganizationJsonLd,
  buildSiteJsonLd,
  canonicalUrl,
  getMetadataBaseUrl,
  jsonLdStringify,
  resolveSeoImage
} from '@/lib/utils/seo';

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
  metadataBase: getMetadataBaseUrl(),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: canonicalUrl('/')
  },
  keywords: [
    'healing frequencies',
    'meditation audio',
    'binaural beats',
    'sound therapy',
    'wellness music'
  ],
  category: 'wellness',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: canonicalUrl('/'),
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: resolveSeoImage('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} cover image`
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [resolveSeoImage('/twitter-image')]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8f7adb' },
    { media: '(prefers-color-scheme: dark)', color: '#172034' }
  ]
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <BackgroundRoot>
          <div className="relative min-h-screen">
            <script
              type="application/ld+json"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: jsonLdStringify(buildSiteJsonLd()) }}
            />
            <script
              type="application/ld+json"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: jsonLdStringify(buildOrganizationJsonLd()) }}
            />
            <Header />
            <main className="mx-auto w-full max-w-[1220px] px-4 pb-24 pt-28 sm:px-6 md:px-10">{children}</main>
            <Footer />
          </div>
        </BackgroundRoot>
      </body>
    </html>
  );
}
