import type { Metadata } from 'next';
import EcstaticSessionSetup from '@/components/ecstatic/EcstaticSessionSetup';
import { buildPageMetadata, normalizeLocale } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);

  return buildPageMetadata({
    title: 'Ecstatic Dance Setup',
    description: 'Configure a standalone Ecstatic Dance session with adaptive audio and visualization packs.',
    path: '/ecstatic',
    locale,
    image: '/images/seo/create-og.jpg',
    imageAlt: 'Ecstatic Dance setup'
  });
}

export default function EcstaticSetupPage() {
  return <EcstaticSessionSetup />;
}
