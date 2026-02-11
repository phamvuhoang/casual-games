import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginClient from '@/app/(auth)/login/LoginClient';
import { buildPageMetadata } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Sign In',
  description: 'Sign in to save and share your healing frequency sessions.',
  path: '/login',
  noIndex: true,
  image: '/opengraph-image',
  imageAlt: 'Frequency Healing Studio sign in'
});

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md text-sm text-ink/70">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
