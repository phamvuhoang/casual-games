import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CallbackClient from '@/app/[locale]/(auth)/callback/CallbackClient';
import { buildPageMetadata } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.metadata' });

  return buildPageMetadata({
    title: t('callbackTitle'),
    description: t('callbackDescription'),
    path: '/auth/callback',
    locale,
    noIndex: true,
    image: '/opengraph-image',
    imageAlt: t('callbackTitle')
  });
}

export default async function AuthCallbackAliasPage() {
  const t = await getTranslations('auth.callback');

  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-halo">
            <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
            <p className="mt-3 text-sm text-ink/70">{t('pageDescription')}</p>
          </div>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
