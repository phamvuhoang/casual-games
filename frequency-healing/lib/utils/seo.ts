import type { Metadata } from 'next';
import { LOCALE_TO_HREFLANG, LOCALE_TO_OG, routing, type AppLocale } from '@/i18n/routing';

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
export const DEFAULT_KEYWORDS_JA = [
  'ヒーリング周波数',
  '周波数ヒーリング',
  'サウンドヒーリング',
  '瞑想周波数',
  'バイノーラルビート',
  '音響療法',
  'ウェルネスオーディオ',
  'ソルフェジオ周波数',
  '睡眠音楽',
  '集中音楽',
  'ストレス緩和',
  'マインドフルネス音声',
  'オーディオビジュアライゼーション',
  '432hz',
  '528hz',
  '639hz',
  '741hz',
  '852hz',
  '963hz'
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

export function normalizeLocale(locale?: string): AppLocale {
  if (locale && routing.locales.includes(locale as AppLocale)) {
    return locale as AppLocale;
  }
  return routing.defaultLocale;
}

export function localizePath(path: string, locale?: string) {
  const normalizedPath = normalizePath(path);
  const normalizedLocale = normalizeLocale(locale);

  if (normalizedLocale === routing.defaultLocale) {
    return normalizedPath;
  }

  if (normalizedPath === '/') {
    return `/${normalizedLocale}`;
  }

  return `/${normalizedLocale}${normalizedPath}`;
}

export function buildLanguageAlternates(path: string) {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [LOCALE_TO_HREFLANG[locale], canonicalUrl(path, locale)])
  );

  return {
    ...languages,
    'x-default': canonicalUrl(path, routing.defaultLocale)
  };
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

export function canonicalUrl(path: string, locale?: string) {
  return absoluteUrl(localizePath(path, locale));
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
  locale?: string;
  image?: string | null;
  twitterImage?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
  type?: 'website' | 'article' | 'profile';
  keywords?: string[];
};

export function buildPageMetadata(options: BuildPageMetadataOptions): Metadata {
  const locale = normalizeLocale(options.locale);
  const title = options.title?.trim() || SITE_NAME;
  const description = options.description?.trim() || DEFAULT_DESCRIPTION;
  const canonical = canonicalUrl(options.path, locale);
  const image = resolveSeoImage(options.image);
  const twitterImage = resolveSeoImage(options.twitterImage ?? options.image);
  const imageAlt = options.imageAlt || `${title} cover image`;
  const robots = buildRobots(Boolean(options.noIndex));
  const fullTitle = buildDocumentTitle(title === SITE_NAME ? '' : title);
  const localeKeywords = locale === 'ja' ? [...DEFAULT_KEYWORDS_JA] : [...DEFAULT_KEYWORDS];
  const keywords = uniqueKeywords(localeKeywords, options.keywords);
  const alternateLocales = routing.locales
    .filter((entry) => entry !== locale)
    .map((entry) => LOCALE_TO_OG[entry]);

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
      languages: buildLanguageAlternates(options.path)
    },
    robots,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: LOCALE_TO_OG[locale],
      alternateLocale: alternateLocales,
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

export function buildSiteJsonLd(options?: { locale?: string; description?: string }) {
  const locale = normalizeLocale(options?.locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: options?.description || DEFAULT_DESCRIPTION,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    url: absoluteUrl(localizePath('/', locale)),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl(localizePath('/discover', locale))}?tag={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  } as const;
}

export function buildOrganizationJsonLd(options?: { locale?: string }) {
  const locale = normalizeLocale(options?.locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl(localizePath('/', locale)),
    logo: resolveSeoImage(DEFAULT_OG_IMAGE)
  } as const;
}
