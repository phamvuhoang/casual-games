import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  absoluteUrl,
  buildPageMetadata,
  canonicalUrl,
  jsonLdStringify,
  resolveSeoImage
} from '@/lib/utils/seo';
import { compositionDescription, getCompositionSeoRecord } from '@/app/(main)/composition/[id]/seo-data';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const record = await getCompositionSeoRecord(id);
  const description = compositionDescription(record);

  return buildPageMetadata({
    title: record?.title?.trim() || 'Listening Session',
    description,
    path: `/composition/${id}`,
    image: `/composition/${id}/opengraph-image`,
    twitterImage: `/composition/${id}/twitter-image`,
    imageAlt: `${record?.title?.trim() || 'Listening Session'} cover art`,
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
  const { id } = await params;
  const record = await getCompositionSeoRecord(id);

  if (!record) {
    return children;
  }

  const description = compositionDescription(record);
  const pageUrl = canonicalUrl(`/composition/${record.id}`);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: record.title,
    description,
    url: pageUrl,
    inLanguage: 'en-US',
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
