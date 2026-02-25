import type { Metadata } from 'next';
import EcstaticVisualLab from '@/components/ecstatic/EcstaticVisualLab';
import { buildPageMetadata, normalizeLocale } from '@/lib/utils/seo';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = normalizeLocale(requestedLocale);

  return buildPageMetadata({
    title: 'Ecstatic Visual Lab',
    description: 'Preview Ecstatic Dance scene stacks, tune transitions, and prepare visualization packs.',
    path: '/ecstatic/visual-lab',
    locale,
    image: '/images/seo/create-og.jpg',
    imageAlt: 'Ecstatic Visual Lab'
  });
}

export default function EcstaticVisualLabPage() {
  return <EcstaticVisualLab />;
}
