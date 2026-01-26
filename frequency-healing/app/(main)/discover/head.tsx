import { DEFAULT_OG_IMAGE, SITE_NAME, canonicalUrl, resolveSeoImage } from '@/lib/utils/seo';

export default function Head() {
  const title = `Discover Sessions | ${SITE_NAME}`;
  const description = 'Browse public healing frequency compositions from the community.';
  const url = canonicalUrl('/discover');
  const image = resolveSeoImage(DEFAULT_OG_IMAGE);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
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
      <meta property="og:image:alt" content="Discover healing frequency sessions" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  );
}
