import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import {
  absoluteUrl,
  buildPageMetadata,
  canonicalUrl,
  jsonLdStringify,
  resolveSeoImage
} from '@/lib/utils/seo';
import { getProfileSeoRecord, profileDescription } from '@/app/[locale]/(main)/profile/[username]/seo-data';

type Params = Promise<{ locale: string; username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const record = await getProfileSeoRecord(username);

  const name = record?.display_name?.trim() || record?.username || t('profileFallbackName');

  return buildPageMetadata({
    title: name,
    description: profileDescription(record, t('profileFallbackDescription')),
    path: `/profile/${username}`,
    locale,
    image: `/profile/${username}/opengraph-image`,
    twitterImage: `/profile/${username}/twitter-image`,
    imageAlt: t('profileImageAlt', { name }),
    type: 'profile',
    keywords: ['healing frequencies', 'creator profile', username]
  });
}

export default async function ProfileLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Params;
}) {
  const { username, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const record = await getProfileSeoRecord(username);

  if (!record) {
    return children;
  }

  const name = record.display_name?.trim() || record.username;
  const description = profileDescription(record, t('profileFallbackDescription'));
  const pageUrl = canonicalUrl(`/profile/${record.username}`, locale);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    alternateName: record.username,
    description,
    url: pageUrl,
    image: resolveSeoImage(absoluteUrl(`/profile/${record.username}/opengraph-image`)),
    dateCreated: record.created_at ?? undefined,
    dateModified: record.updated_at ?? undefined
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
