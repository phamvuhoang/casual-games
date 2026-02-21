import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, IBM_Plex_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { NextIntlClientProvider } from 'next-intl';
import { hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BackgroundRoot from '@/components/background/BackgroundRoot';
import { routing } from '@/i18n/routing';
import {
  SITE_NAME,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSiteJsonLd,
  buildSiteVerification,
  getMetadataBaseUrl,
  jsonLdStringify
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

type Params = Promise<{ locale: string }>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = hasLocale(routing.locales, requestedLocale) ? requestedLocale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const base = buildPageMetadata({
    title: SITE_NAME,
    description: t('defaultDescription'),
    path: '/',
    locale,
    image: '/opengraph-image',
    twitterImage: '/twitter-image',
    imageAlt: `${SITE_NAME} cover image`
  });

  return {
    ...base,
    metadataBase: getMetadataBaseUrl(),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`
    },
    applicationName: SITE_NAME,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon.ico']
    },
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    verification: buildSiteVerification(),
    category: 'wellness'
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8f7adb' },
    { media: '(prefers-color-scheme: dark)', color: '#172034' }
  ]
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Params;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return (
    <html lang={locale} className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <BackgroundRoot>
            <div className="relative min-h-screen">
              <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{
                  __html: jsonLdStringify(buildSiteJsonLd({ locale, description: t('defaultDescription') }))
                }}
              />
              <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: jsonLdStringify(buildOrganizationJsonLd({ locale })) }}
              />
              <Header />
              <main className="mx-auto w-full max-w-[1220px] px-4 pb-24 pt-28 sm:px-6 md:px-10">{children}</main>
              <Footer />
            </div>
          </BackgroundRoot>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
