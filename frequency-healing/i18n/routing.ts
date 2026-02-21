import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ja', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: true,
  alternateLinks: true,
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365
  }
});

export type AppLocale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  ja: '日本語',
  vi: 'Tiếng Việt'
};

export const LOCALE_TO_OG: Record<AppLocale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  vi: 'vi_VN'
};

export const LOCALE_TO_HREFLANG: Record<AppLocale, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  vi: 'vi-VN'
};
