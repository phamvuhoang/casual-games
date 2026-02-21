import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/utils/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/discover', '/composition/', '/profile/', '/ja', '/ja/discover', '/ja/composition/', '/ja/profile/'],
        disallow: [
          '/api/',
          '/auth/',
          '/callback',
          '/login',
          '/signup',
          '/create',
          '/ja/callback',
          '/ja/login',
          '/ja/signup',
          '/ja/create'
        ]
      }
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl()
  };
}
