'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatFrequencyList } from '@/lib/utils/helpers';
import Link from 'next/link';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Composition = Database['public']['Tables']['compositions']['Row'];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const supabase = createSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!isMounted) {
        return;
      }

      if (profileError) {
        setStatus(profileError.message);
        return;
      }

      setProfile(profileData);

      const { data: compositionData } = await supabase
        .from('compositions')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (compositionData) {
        setCompositions(compositionData);
      }
    };

    if (username) {
      loadProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [supabase, username]);

  if (!profile) {
    return <p className="text-sm text-ink/70">{status ?? 'Loading profile...'}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{profile.display_name ?? profile.username}</h1>
        {profile.bio ? <p className="mt-2 text-sm text-ink/70">{profile.bio}</p> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {compositions.map((composition) => (
          <Card key={composition.id} className="glass-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{composition.title}</h2>
                <p className="text-xs text-ink/60">{formatFrequencyList(composition.frequencies)}</p>
              </div>
              <Link
                href={`/composition/${composition.id}`}
                className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                View
              </Link>
            </div>
            {composition.description ? (
              <p className="mt-3 text-sm text-ink/70">{composition.description}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
