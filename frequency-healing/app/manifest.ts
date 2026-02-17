import type { MetadataRoute } from 'next';
import { SITE_NAME, absoluteUrl } from '@/lib/utils/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Frequency Healing',
    description: 'Create, explore, and share healing frequency soundscapes with reactive visuals.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0f1a',
    theme_color: '#8f7adb',
    orientation: 'portrait',
    lang: 'en-US',
    icons: [
      {
        src: absoluteUrl('/images/og-default.svg'),
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  };
}
