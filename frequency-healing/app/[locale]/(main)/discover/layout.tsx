import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { absoluteUrl, buildPageMetadata, jsonLdStringify, localizePath } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return buildPageMetadata({
    title: t('discoverTitle'),
    description: t('discoverDescription'),
    path: '/discover',
    locale,
    image: '/opengraph-image',
    imageAlt: t('discoverTitle')
  });
}

export default async function DiscoverLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const discoverJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('discoverJsonLdName'),
    description: t('discoverJsonLdDescription'),
    url: absoluteUrl(localizePath('/discover', locale))
  } as const;

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(discoverJsonLd) }}
      />
      {children}
    </>
  );
}
