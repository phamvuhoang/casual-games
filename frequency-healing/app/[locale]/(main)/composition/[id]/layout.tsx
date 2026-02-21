import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LOCALE_TO_HREFLANG } from '@/i18n/routing';
import {
  absoluteUrl,
  buildPageMetadata,
  canonicalUrl,
  jsonLdStringify,
  normalizeLocale,
  resolveSeoImage
} from '@/lib/utils/seo';
import { compositionDescription, getCompositionSeoRecord } from '@/app/[locale]/(main)/composition/[id]/seo-data';

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const record = await getCompositionSeoRecord(id);
  const fallbackTitle = t('compositionFallbackTitle');
  const description = compositionDescription(record, {
    defaultDescription: t('defaultDescription'),
    fallbackDescription: t('compositionFallbackDescription'),
    withFrequenciesDescription: (frequencies) => t('compositionWithFrequencies', { frequencies })
  });
  const title = record?.title?.trim() || fallbackTitle;

  return buildPageMetadata({
    title,
    description,
    path: `/composition/${id}`,
    locale,
    image: `/composition/${id}/opengraph-image`,
    twitterImage: `/composition/${id}/twitter-image`,
    imageAlt: t('compositionCoverAlt', { title }),
    type: 'article',
    keywords: ['healing frequencies', ...(record?.tags ?? [])]
  });
}

export default async function CompositionLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Params;
}) {
  const { id, locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const record = await getCompositionSeoRecord(id);

  if (!record) {
    return children;
  }

  const description = compositionDescription(record, {
    defaultDescription: t('defaultDescription'),
    fallbackDescription: t('compositionFallbackDescription'),
    withFrequenciesDescription: (frequencies) => t('compositionWithFrequencies', { frequencies })
  });
  const pageUrl = canonicalUrl(`/composition/${record.id}`, locale);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: record.title,
    description,
    url: pageUrl,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    image: resolveSeoImage(absoluteUrl(`/composition/${record.id}/opengraph-image`)),
    isAccessibleForFree: true,
    datePublished: record.created_at ?? undefined,
    dateModified: record.updated_at ?? undefined,
    duration: typeof record.duration === 'number' ? `PT${Math.max(0, record.duration)}S` : undefined,
    keywords: record.tags ?? [],
    audio: record.audio_url
      ? {
          '@type': 'AudioObject',
          contentUrl: record.audio_url,
          name: record.title,
          description
        }
      : undefined
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(jsonLd) }}
      />
      {children}
    </>
  );
}
