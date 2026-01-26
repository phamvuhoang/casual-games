import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatFrequencyList } from '@/lib/utils/helpers';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  canonicalUrl,
  resolveSeoImage
} from '@/lib/utils/seo';

type CompositionHeadProps = {
  params: {
    id: string;
  };
};

export default async function Head({ params }: CompositionHeadProps) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('compositions')
    .select('title, description, frequencies, thumbnail_url')
    .eq('id', params.id)
    .maybeSingle();

  const baseTitle = data?.title?.trim() || 'Listening Session';
  const title = `${baseTitle} | ${SITE_NAME}`;
  const frequencySummary =
    data?.frequencies && data.frequencies.length > 0 ? formatFrequencyList(data.frequencies) : '';
  const description =
    data?.description?.trim() ||
    (frequencySummary
      ? `Listen to a healing frequency session featuring ${frequencySummary}.`
      : 'Listen to a shared healing frequency session with immersive visuals.');

  const url = canonicalUrl(`/composition/${params.id}`);
  const image = resolveSeoImage(data?.thumbnail_url ?? DEFAULT_OG_IMAGE);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="robots" content="index, follow" />
      {url ? <link rel="canonical" href={url} /> : null}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description || DEFAULT_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${baseTitle} cover art`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={image} />
    </>
  );
}
