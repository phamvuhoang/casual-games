import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_DESCRIPTION } from '@/lib/utils/seo';

export type ProfileSeoRecord = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const getProfileSeoRecord = cache(async (username: string): Promise<ProfileSeoRecord | null> => {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url, created_at, updated_at')
    .eq('username', username)
    .maybeSingle();

  return data;
});

export function profileDescription(record: ProfileSeoRecord | null, fallback?: string) {
  if (!record) {
    return fallback || DEFAULT_DESCRIPTION;
  }

  return record.bio?.trim() || fallback || 'Explore a creator profile and their healing frequency compositions.';
}
