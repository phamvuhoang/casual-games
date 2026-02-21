'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS, routing, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/helpers';

type LanguageSwitcherProps = {
  variant?: 'desktop' | 'mobile';
  className?: string;
};

export default function LanguageSwitcher({ variant = 'desktop', className }: LanguageSwitcherProps) {
  const t = useTranslations('common.header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (nextLocale: AppLocale) => {
    router.replace(pathname, { locale: nextLocale });
  };

  if (variant === 'mobile') {
    return (
      <label
        className={cn(
          'flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 text-ink/70',
          className
        )}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/60">{t('language')}</span>
        <select
          aria-label={t('language')}
          className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-medium"
          value={locale}
          onChange={(event) => handleLocaleChange(event.target.value as AppLocale)}
        >
          {routing.locales.map((localeOption) => (
            <option key={localeOption} value={localeOption}>
              {LOCALE_LABELS[localeOption]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={cn('inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white/82 px-3 py-2 text-xs text-ink/70', className)}>
      <span className="uppercase tracking-[0.14em]">{t('language')}</span>
      <select
        aria-label={t('language')}
        className="rounded-full border border-ink/15 bg-white px-2 py-1 text-xs"
        value={locale}
        onChange={(event) => handleLocaleChange(event.target.value as AppLocale)}
      >
        {routing.locales.map((localeOption) => (
          <option key={localeOption} value={localeOption}>
            {LOCALE_LABELS[localeOption]}
          </option>
        ))}
      </select>
    </label>
  );
}
