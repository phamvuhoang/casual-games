import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  canonicalUrl,
  resolveSeoImage
} from '@/lib/utils/seo';

type ProfileHeadProps = {
  params: {
    username: string;
  };
};

export default async function Head({ params }: ProfileHeadProps) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url')
    .eq('username', params.username)
    .maybeSingle();

  const baseTitle = data?.display_name?.trim() || data?.username || 'Creator Profile';
  const title = `${baseTitle} | ${SITE_NAME}`;
  const description =
    data?.bio?.trim() || 'Explore a creator profile and their healing frequency compositions.';
  const url = canonicalUrl(`/profile/${params.username}`);
  const image = resolveSeoImage(data?.avatar_url ?? DEFAULT_OG_IMAGE);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="robots" content="index, follow" />
      {url ? <link rel="canonical" href={url} /> : null}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description || DEFAULT_DESCRIPTION} />
      <meta property="og:type" content="profile" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${baseTitle} profile`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={image} />
    </>
  );
}
