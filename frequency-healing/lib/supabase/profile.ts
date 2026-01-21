import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const USERNAME_FALLBACK = 'user';

export async function ensureProfile(supabase: SupabaseClient<Database>, user: User) {
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing?.id) {
    return existing;
  }

  const metadataUsername =
    typeof user.user_metadata?.username === 'string' ? user.user_metadata.username.trim() : '';
  const emailPrefix = user.email ? user.email.split('@')[0] : '';
  const base = metadataUsername || emailPrefix || USERNAME_FALLBACK;
  const displayName = metadataUsername || emailPrefix || 'Frequency Listener';

  const primaryUsername = sanitizeUsername(base);
  const fallbackUsername = sanitizeUsername(`${base}-${user.id.slice(0, 6)}`);

  const payload = {
    id: user.id,
    username: primaryUsername,
    display_name: displayName
  };

  const { error: insertError } = await supabase.from('profiles').insert(payload);

  if (insertError && insertError.code === '23505' && primaryUsername !== fallbackUsername) {
    const { error: fallbackError } = await supabase.from('profiles').insert({
      ...payload,
      username: fallbackUsername
    });

    if (fallbackError) {
      throw fallbackError;
    }

    return { id: user.id };
  }

  if (insertError) {
    throw insertError;
  }

  return { id: user.id };
}

function sanitizeUsername(value: string) {
  const trimmed = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return trimmed || `${USERNAME_FALLBACK}-${Math.random().toString(36).slice(2, 8)}`;
}
