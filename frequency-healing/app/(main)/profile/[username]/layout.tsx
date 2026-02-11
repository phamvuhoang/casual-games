import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  absoluteUrl,
  buildPageMetadata,
  canonicalUrl,
  jsonLdStringify,
  resolveSeoImage
} from '@/lib/utils/seo';
import { getProfileSeoRecord, profileDescription } from '@/app/(main)/profile/[username]/seo-data';

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const record = await getProfileSeoRecord(username);

  const name = record?.display_name?.trim() || record?.username || 'Creator Profile';

  return buildPageMetadata({
    title: name,
    description: profileDescription(record),
    path: `/profile/${username}`,
    image: `/profile/${username}/opengraph-image`,
    twitterImage: `/profile/${username}/twitter-image`,
    imageAlt: `${name} profile`,
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
  const { username } = await params;
  const record = await getProfileSeoRecord(username);

  if (!record) {
    return children;
  }

  const name = record.display_name?.trim() || record.username;
  const description = profileDescription(record);
  const pageUrl = canonicalUrl(`/profile/${record.username}`);

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
