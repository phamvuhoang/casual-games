import type { MetadataRoute } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/utils/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: absoluteUrl('/discover'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9
    }
  ];

  try {
    const supabase = createSupabaseServerClient();

    const [{ data: compositions }, { data: profiles }] = await Promise.all([
      supabase
        .from('compositions')
        .select('id, updated_at, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('profiles')
        .select('username, updated_at, created_at')
        .order('created_at', { ascending: false })
        .limit(5000)
    ]);

    const compositionRoutes: MetadataRoute.Sitemap = (compositions ?? []).map((composition) => ({
      url: absoluteUrl(`/composition/${composition.id}`),
      lastModified: composition.updated_at ?? composition.created_at ?? now,
      changeFrequency: 'weekly',
      priority: 0.8
    }));

    const profileRoutes: MetadataRoute.Sitemap = (profiles ?? [])
      .filter((profile) => Boolean(profile.username))
      .map((profile) => ({
        url: absoluteUrl(`/profile/${profile.username}`),
        lastModified: profile.updated_at ?? profile.created_at ?? now,
        changeFrequency: 'weekly',
        priority: 0.7
      }));

    return [...staticRoutes, ...compositionRoutes, ...profileRoutes];
  } catch (_error) {
    return staticRoutes;
  }
}
