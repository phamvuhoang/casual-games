import type { Metadata } from 'next';
import ProfileRedirectClient from '@/app/(main)/profile/ProfileRedirectClient';
import { buildPageMetadata } from '@/lib/utils/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Your Profile',
  description: 'Open your profile and manage your healing frequency collections.',
  path: '/profile',
  noIndex: true,
  image: '/opengraph-image',
  imageAlt: 'Open your profile'
});

export default function ProfileRedirectPage() {
  return <ProfileRedirectClient />;
}
