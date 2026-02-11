import type { Metadata } from 'next';
import FrequencyCreator from '@/components/audio/FrequencyCreator';
import { buildPageMetadata } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Create a Session',
  description: 'Compose a custom healing frequency session with live audio-reactive visuals.',
  path: '/create',
  noIndex: true,
  image: '/opengraph-image',
  imageAlt: 'Create a healing frequency session'
});

export default function CreatePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <div className="glass-panel rounded-3xl p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Creator Studio</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Compose a healing frequency session.</h1>
        <p className="mt-3 max-w-3xl text-sm text-ink/70">
          Keep the controls minimal during practice: press <strong>Atmosphere</strong> in the lower-right corner to
          randomize, lock, or disable the animated background.
        </p>
      </div>
      <FrequencyCreator />
    </div>
  );
}
