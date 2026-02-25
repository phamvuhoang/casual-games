import type { Metadata } from 'next';
import EcstaticReplayPanel from '@/components/ecstatic/EcstaticReplayPanel';
import { buildPageMetadata, normalizeLocale } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);

  return buildPageMetadata({
    title: 'Ecstatic Dance Replay',
    description: 'Inspect local Ecstatic Dance session timelines and export/import JSON snapshots.',
    path: '/ecstatic/replay',
    locale,
    image: '/images/seo/create-og.jpg',
    imageAlt: 'Ecstatic Dance replay'
  });
}

export default function EcstaticReplayPage() {
  return <EcstaticReplayPanel />;
}
