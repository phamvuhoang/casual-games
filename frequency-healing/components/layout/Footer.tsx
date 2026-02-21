'use client';

import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('common.footer');

  return (
    <footer className="mt-20 pb-6">
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-3 rounded-3xl border border-white/45 bg-white/64 px-5 py-5 text-sm text-ink/65 shadow-[0_18px_44px_rgba(35,32,68,0.12)] backdrop-blur md:flex-row md:items-center md:justify-between md:px-7">
        <p>{t('tagline')}</p>
        <p>{t('disclaimer')}</p>
      </div>
    </footer>
  );
}
