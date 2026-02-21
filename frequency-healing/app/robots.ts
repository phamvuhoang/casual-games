import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/utils/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/*/create', '/*/discover', '/*/composition/', '/*/profile/'],
        disallow: [
          '/api/',
          '/auth/',
          '/callback',
          '/login',
          '/signup',
          '/*/auth/',
          '/*/callback',
          '/*/login',
          '/*/signup'
        ]
      }
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl()
  };
}
