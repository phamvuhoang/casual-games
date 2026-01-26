import { DEFAULT_OG_IMAGE, SITE_NAME, canonicalUrl, resolveSeoImage } from '@/lib/utils/seo';

export default function Head() {
  const title = `Sign In | ${SITE_NAME}`;
  const description = 'Sign in to save and share your healing frequency sessions.';
  const url = canonicalUrl('/login');
  const image = resolveSeoImage(DEFAULT_OG_IMAGE);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex, nofollow" />
      {url ? <link rel="canonical" href={url} /> : null}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Frequency Healing Studio sign in" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  );
}
