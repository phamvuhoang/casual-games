import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from '@/i18n/routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages =
    locale === 'ja'
      ? (await import('@/messages/ja.json')).default
      : locale === 'vi'
        ? (await import('@/messages/vi.json')).default
        : (await import('@/messages/en.json')).default;

  return {
    locale,
    messages
  };
});
