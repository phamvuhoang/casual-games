import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SignupClient from '@/app/[locale]/(auth)/signup/SignupClient';
import { buildPageMetadata } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.metadata' });

  return buildPageMetadata({
    title: t('signupTitle'),
    description: t('signupDescription'),
    path: '/signup',
    locale,
    noIndex: true,
    image: '/opengraph-image',
    imageAlt: t('signupTitle')
  });
}

export default async function SignupPage() {
  const t = await getTranslations('common');

  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md text-sm text-ink/70">{t('loading')}</div>}>
      <SignupClient />
    </Suspense>
  );
}
