import type { Metadata } from 'next';
import BreathVisualizationGame from '@/components/breath/BreathVisualizationGame';
import { getTranslations } from 'next-intl/server';
import { LOCALE_TO_HREFLANG, type AppLocale } from '@/i18n/routing';
import {
  SITE_NAME,
  absoluteUrl,
  buildPageMetadata,
  jsonLdStringify,
  localizePath,
  normalizeLocale
} from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

const HOME_KEYWORDS: Record<AppLocale, string[]> = {
  en: [
    'healing frequency app',
    'breath visualization',
    'breath sync meditation',
    'voice bioprint',
    'audio reactive meditation',
    'coherence breathing'
  ],
  ja: [
    'ヒーリング周波数アプリ',
    '呼吸ビジュアライゼーション',
    'ブレスシンク瞑想',
    'Voice Bioprint',
    '音声反応ビジュアル瞑想',
    'コヒーレンス呼吸'
  ],
  vi: [
    'ứng dụng tần số chữa lành',
    'trực quan hóa hơi thở',
    'breath sync thiền',
    'voice bioprint',
    'thiền với visual phản ứng âm thanh',
    'thở coherence'
  ]
};

const HOME_FEATURES: Record<AppLocale, string[]> = {
  en: [
    'Guest breath visualization with microphone input',
    'Real-time healing frequency synthesis',
    'Breath coherence rhythm guidance',
    'Client-side session with no account required'
  ],
  ja: [
    'マイク入力を使うゲスト向け呼吸ビジュアライゼーション',
    'リアルタイムのヒーリング周波数生成',
    '呼吸コヒーレンスのリズムガイド',
    'アカウント不要のクライアント側セッション'
  ],
  vi: [
    'Trực quan hóa hơi thở cho guest bằng micro',
    'Tạo tần số chữa lành theo thời gian thực',
    'Dẫn nhịp thở coherence theo rhythm',
    'Phiên chạy client-side không cần tài khoản'
  ]
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return buildPageMetadata({
    title: t('homeTitle'),
    description: t('defaultDescription'),
    path: '/',
    locale,
    image: '/images/seo/home-og.jpg',
    twitterImage: '/images/seo/home-twitter.jpg',
    imageAlt: t('homeTitle'),
    keywords: HOME_KEYWORDS[locale]
  });
}

export default async function HomePage({ params }: { params: Params }) {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'metadata' })
  ]);

  const pageUrl = absoluteUrl(localizePath('/', locale));
  const createUrl = absoluteUrl(localizePath('/create', locale));

  const homePageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: tMeta('homeTitle'),
    description: tMeta('defaultDescription'),
    url: pageUrl,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: pageUrl
    },
    primaryImageOfPage: absoluteUrl('/images/seo/home-og.jpg')
  } as const;

  const homeApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web Browser',
    url: createUrl,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    description: tMeta('createDescription'),
    isAccessibleForFree: true,
    featureList: HOME_FEATURES[locale]
  } as const;

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(homePageJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(homeApplicationJsonLd) }}
      />

      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-6">
        <section className="fade-in mx-auto max-w-3xl px-2 text-center">
          <h1 className="text-[2rem] font-semibold leading-tight sm:text-[2.8rem]">{t('title')}</h1>
          <p className="mt-3 text-base text-ink/75 sm:text-lg">{t('subtitle')}</p>
        </section>

        <BreathVisualizationGame
          prompt={t('prompt')}
          allowMicHint={t('allowMicHint')}
          startLabel={t('startButton')}
          retryLabel={t('retry')}
          startingLabel={t('starting')}
          listeningLabel={t('listening')}
          micDeniedMessage={t('micDenied')}
          micUnavailableMessage={t('micUnavailable')}
          phaseInhaleLabel={t('phaseInhale')}
          phaseExhaleLabel={t('phaseExhale')}
          breathRateLabel={t('breathRateLabel')}
          coherenceLabel={t('coherenceLabel')}
          rhythmLabel={t('rhythmLabel')}
          frequencyLabel={t('frequencyLabel')}
          stopControlLabel={t('stopControlLabel')}
          stopControlHint={t('stopControlHint')}
          stopControlProgressHint={t('stopControlProgressHint')}
          stopControlCompleting={t('stopControlCompleting')}
          sessionReadyTitle={t('sessionReadyTitle')}
          sessionReadyBody={t('sessionReadyBody')}
          sessionCtaLabel={t('sessionCta')}
        />
      </div>
    </>
  );
}
