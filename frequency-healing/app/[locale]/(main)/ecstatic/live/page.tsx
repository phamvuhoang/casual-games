import type { Metadata } from 'next';
import EcstaticLiveStage from '@/components/ecstatic/EcstaticLiveStage';
import { buildPageMetadata, normalizeLocale } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);

  return buildPageMetadata({
    title: 'Ecstatic Dance Live',
    description: 'Run a fullscreen Ecstatic Dance conductor session with phase controls and live visual orchestration.',
    path: '/ecstatic/live',
    locale,
    image: '/images/seo/create-og.jpg',
    imageAlt: 'Ecstatic Dance live'
  });
}

export default function EcstaticLivePage() {
  return <EcstaticLiveStage />;
}
