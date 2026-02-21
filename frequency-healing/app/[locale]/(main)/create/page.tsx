import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FrequencyCreator from '@/components/audio/FrequencyCreator';
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

const CREATE_KEYWORDS: Record<AppLocale, string[]> = {
  en: [
    'healing frequency generator',
    'solfeggio frequency generator',
    'binaural beat creator',
    'meditation audio composer',
    'breath sync meditation tool',
    'custom frequency stack',
    'adaptive binaural journey',
    'voice bioprint',
    'quantum intention mapping',
    'harmonic field generator',
    'sympathetic resonance'
  ],
  ja: [
    'ヒーリング周波数ジェネレーター',
    'ソルフェジオ周波数ジェネレーター',
    'バイノーラルビート作成',
    '瞑想音声コンポーザー',
    '呼吸シンク瞑想ツール',
    'カスタム周波数スタック',
    'アダプティブバイノーラルジャーニー',
    'Voice Bioprint',
    '量子意図マッピング',
    'ハーモニックフィールド生成',
    '共鳴ルームチューニング'
  ],
  vi: [
    'trình tạo tần số chữa lành',
    'trình tạo tần số solfeggio',
    'trình tạo binaural beat',
    'công cụ soạn âm thanh thiền',
    'công cụ breath-sync',
    'chồng tần số tùy chỉnh',
    'lộ trình binaural thích ứng',
    'voice bioprint',
    'ánh xạ ý định lượng tử',
    'harmonic field generator',
    'cộng hưởng phòng âm'
  ]
};

const CREATE_FEATURES: Record<AppLocale, string[]> = {
  en: [
    'Custom frequency stack (20-2000Hz)',
    'Adaptive binaural journey templates',
    'Breath-sync protocol with pacing guidance',
    'Voice Bioprint vocal spectrum mapping',
    'Quantum intention mapping and harmonic field tools'
  ],
  ja: [
    'カスタム周波数スタック（20〜2000Hz）',
    'アダプティブ・バイノーラル・ジャーニー',
    '呼吸ペーシング付き Breath-Sync プロトコル',
    'Voice Bioprint 音声スペクトラム解析',
    '量子意図マッピングとハーモニックフィールド'
  ],
  vi: [
    'Chồng tần số tùy chỉnh (20-2000Hz)',
    'Lộ trình binaural thích ứng',
    'Giao thức Breath-Sync có hướng dẫn nhịp thở',
    'Voice Bioprint phân tích phổ giọng nói',
    'Ánh xạ ý định lượng tử và công cụ harmonic field'
  ]
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return buildPageMetadata({
    title: t('createTitle'),
    description: t('createDescription'),
    path: '/create',
    locale,
    image: '/images/seo/create-og.jpg',
    twitterImage: '/images/seo/create-twitter.jpg',
    imageAlt: t('createTitle'),
    keywords: CREATE_KEYWORDS[locale]
  });
}

export default async function CreatePage({ params }: { params: Params }) {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);
  const [t, tMeta] = await Promise.all([
    getTranslations('create'),
    getTranslations({ locale, namespace: 'metadata' })
  ]);
  const pageUrl = absoluteUrl(localizePath('/create', locale));
  const homeUrl = absoluteUrl(localizePath('/', locale));

  const createPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: tMeta('createTitle'),
    description: tMeta('createDescription'),
    url: pageUrl,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: homeUrl
    }
  } as const;

  const createAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${SITE_NAME} Creator`,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web Browser',
    url: pageUrl,
    inLanguage: LOCALE_TO_HREFLANG[locale],
    description: tMeta('createDescription'),
    isAccessibleForFree: true,
    featureList: CREATE_FEATURES[locale]
  } as const;

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(createPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(createAppJsonLd) }}
      />
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div className="glass-panel rounded-3xl p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.28em] text-ink/60">{t('studioLabel')}</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{t('title')}</h1>
          <p className="mt-3 max-w-3xl text-sm text-ink/70">{t('description')}</p>
        </div>
        <FrequencyCreator />
      </div>
    </>
  );
}
