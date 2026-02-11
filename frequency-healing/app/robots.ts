import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/utils/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/discover', '/composition/', '/profile/'],
        disallow: ['/api/', '/auth/', '/callback', '/login', '/signup', '/create']
      }
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl()
  };
}
