import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl, buildPageMetadata, jsonLdStringify } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Discover Sessions',
  description: 'Browse public healing frequency compositions from the community.',
  path: '/discover',
  image: '/opengraph-image',
  imageAlt: 'Discover healing frequency sessions'
});

const discoverJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Discover Sessions',
  description: 'Browse public healing frequency compositions from the community.',
  url: absoluteUrl('/discover')
} as const;

export default function DiscoverLayout({ children }: { children: ReactNode }) {
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
