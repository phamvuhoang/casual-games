import { Suspense } from 'react';
import type { Metadata } from 'next';
import SignupClient from '@/app/(auth)/signup/SignupClient';
import { buildPageMetadata } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Create Account',
  description: 'Create an account to save, publish, and revisit your compositions.',
  path: '/signup',
  noIndex: true,
  image: '/opengraph-image',
  imageAlt: 'Frequency Healing Studio sign up'
});

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md text-sm text-ink/70">Loading...</div>}>
      <SignupClient />
    </Suspense>
  );
}
