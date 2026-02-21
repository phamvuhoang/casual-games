import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FrequencyCreator from '@/components/audio/FrequencyCreator';
import { buildPageMetadata } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return buildPageMetadata({
    title: t('createTitle'),
    description: t('createDescription'),
    path: '/create',
    locale,
    noIndex: true,
    image: '/opengraph-image',
    imageAlt: t('createTitle')
  });
}

export default async function CreatePage() {
  const t = await getTranslations('create');

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <div className="glass-panel rounded-3xl p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">{t('studioLabel')}</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-3xl text-sm text-ink/70">{t('description')}</p>
      </div>
      <FrequencyCreator />
    </div>
  );
}
