import type { Metadata } from 'next';
import AuthCallbackPage from '@/app/(auth)/callback/page';
import { buildPageMetadata } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Auth Callback',
  description: 'Completing your sign-in.',
  path: '/auth/callback',
  noIndex: true,
  image: '/opengraph-image',
  imageAlt: 'Frequency Healing Studio auth callback'
});

export default AuthCallbackPage;
