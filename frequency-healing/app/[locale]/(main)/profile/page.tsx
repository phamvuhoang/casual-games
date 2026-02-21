import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ProfileRedirectClient from '@/app/[locale]/(main)/profile/ProfileRedirectClient';
import { buildPageMetadata } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return buildPageMetadata({
    title: t('profileTitle'),
    description: t('profileDescription'),
    path: '/profile',
    locale,
    noIndex: true,
    image: '/opengraph-image',
    imageAlt: t('profileOpenAlt')
  });
}

export default function ProfileRedirectPage() {
  return <ProfileRedirectClient />;
}
