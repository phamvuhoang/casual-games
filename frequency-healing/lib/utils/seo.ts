import type { Metadata } from 'next';

export const SITE_NAME = 'Frequency Healing Studio';
export const DEFAULT_DESCRIPTION =
  'Create, explore, and share healing frequency soundscapes with audio-reactive visuals.';
export const DEFAULT_OG_IMAGE = '/images/og-default.svg';
export const DEFAULT_KEYWORDS = [
  'healing frequencies',
  'frequency healing',
  'sound healing music',
  'meditation frequencies',
  'meditation music',
  'binaural beats',
  'sound therapy',
  'wellness audio',
  'nervous system regulation',
  'nervous system reset',
  'brainwave entrainment',
  'isochronic tones',
  'chakra healing',
  'chakra frequency music',
  'solfeggio frequencies',
  'sleep music',
  'deep sleep music',
  'focus music',
  'study music',
  'relaxation sounds',
  'calming background music',
  'stress relief audio',
  'anxiety relief music',
  'mindfulness audio',
  'audio visualization',
  '174 hz',
  '285 hz',
  '396 hz',
  '417 hz',
  '432 hz',
  '440 hz',
  '444 hz',
  '528 hz',
  '639 hz',
  '741 hz',
  '852 hz',
  '888 hz',
  '963 hz',
  '40 hz focus'
] as const;

const FALLBACK_SITE_URL = 'http://localhost:3000';
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
const rawTwitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? '';

function normalizeSiteUrl(value: string) {
  if (!value.trim()) {
    return '';
  }

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch (_error) {
    return '';
  }
}

function normalizePath(path: string) {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

const SITE_URL = normalizeSiteUrl(rawSiteUrl);
const TWITTER_HANDLE = rawTwitterHandle.replace(/^@/, '').trim();

function uniqueKeywords(...groups: Array<Array<string | undefined> | undefined>) {
  const seen = new Set<string>();

  for (const group of groups) {
    if (!group) continue;

    for (const keyword of group) {
      const value = keyword?.trim().toLowerCase();
      if (!value) continue;
      seen.add(value);
    }
  }

  return Array.from(seen);
}

function firstPresentValue(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

export function getSiteUrl() {
  return SITE_URL || FALLBACK_SITE_URL;
}

export function getMetadataBaseUrl() {
  return new URL(getSiteUrl());
}

export function absoluteUrl(path: string) {
  const normalizedPath = normalizePath(path);

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = getSiteUrl();
  return `${base}${normalizedPath}`;
}

export function canonicalUrl(path: string) {
  return absoluteUrl(path);
}

export function resolveSeoImage(url?: string | null) {
  if (!url) {
    return absoluteUrl(DEFAULT_OG_IMAGE);
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return absoluteUrl(url);
}

export function buildSiteVerification(): Metadata['verification'] | undefined {
  const google = firstPresentValue(
    process.env.GOOGLE_SITE_VERIFICATION,
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  );
  const yandex = firstPresentValue(
    process.env.YANDEX_SITE_VERIFICATION,
    process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION
  );
  const yahoo = firstPresentValue(
    process.env.YAHOO_SITE_VERIFICATION,
    process.env.NEXT_PUBLIC_YAHOO_SITE_VERIFICATION
  );
  const me = firstPresentValue(process.env.SEO_ME_VERIFICATION, process.env.NEXT_PUBLIC_SEO_ME_VERIFICATION);
  const otherBing = firstPresentValue(
    process.env.BING_SITE_VERIFICATION,
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
  );

  if (!google && !yandex && !yahoo && !me && !otherBing) {
    return undefined;
  }

  return {
    google,
    yandex,
    yahoo,
    me: me ? [me] : undefined,
    other: otherBing
      ? {
          'msvalidate.01': otherBing
        }
      : undefined
  };
}

export function buildDocumentTitle(title?: string | null) {
  if (!title || !title.trim()) {
    return SITE_NAME;
  }
  return `${title.trim()} | ${SITE_NAME}`;
}

export function buildRobots(noIndex = false): Metadata['robots'] {
  if (noIndex) {
    return {
      index: false,
      follow: false,
      noarchive: true,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        'max-image-preview': 'none',
        'max-snippet': -1,
        'max-video-preview': -1
      }
    };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  };
}

type BuildPageMetadataOptions = {
  title?: string;
  description?: string;
  path: string;
  image?: string | null;
  twitterImage?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
  type?: 'website' | 'article' | 'profile';
  keywords?: string[];
};

export function buildPageMetadata(options: BuildPageMetadataOptions): Metadata {
  const title = options.title?.trim() || SITE_NAME;
  const description = options.description?.trim() || DEFAULT_DESCRIPTION;
  const canonical = canonicalUrl(options.path);
  const image = resolveSeoImage(options.image);
  const twitterImage = resolveSeoImage(options.twitterImage ?? options.image);
  const imageAlt = options.imageAlt || `${title} cover image`;
  const robots = buildRobots(Boolean(options.noIndex));
  const fullTitle = buildDocumentTitle(title === SITE_NAME ? '' : title);
  const keywords = uniqueKeywords([...DEFAULT_KEYWORDS], options.keywords);

  return {
    title,
    description,
    keywords,
    referrer: 'origin-when-cross-origin',
    formatDetection: {
      telephone: false,
      address: false,
      email: false
    },
    alternates: {
      canonical,
      languages: {
        'en-US': canonical,
        'x-default': canonical
      }
    },
    robots,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: options.type ?? 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: imageAlt
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [twitterImage],
      ...(TWITTER_HANDLE
        ? {
            creator: `@${TWITTER_HANDLE}`,
            site: `@${TWITTER_HANDLE}`
          }
        : {})
    }
  };
}

export function jsonLdStringify(payload: unknown) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export function buildSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/discover')}?tag={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  } as const;
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: resolveSeoImage(DEFAULT_OG_IMAGE)
  } as const;
}
