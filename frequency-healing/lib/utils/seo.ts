export const SITE_NAME = 'Frequency Healing Studio';
export const DEFAULT_DESCRIPTION =
  'Create, explore, and share healing frequency soundscapes with audio-reactive visuals.';
export const DEFAULT_OG_IMAGE = '/images/og-default.svg';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? '';

export function absoluteUrl(path: string) {
  if (!path) {
    return SITE_URL;
  }

  if (!SITE_URL) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  const base = SITE_URL.endsWith('/') ? SITE_URL.slice(0, -1) : SITE_URL;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function canonicalUrl(path: string) {
  if (!SITE_URL) {
    return '';
  }
  return absoluteUrl(path);
}

export function resolveSeoImage(url?: string | null) {
  if (url) {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return absoluteUrl(url);
  }

  return absoluteUrl(DEFAULT_OG_IMAGE);
}
