'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';

export default function ProfileRedirectClient() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [status, setStatus] = useState('Loading your profile...');
  const [requiresAuth, setRequiresAuth] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!isMounted) {
        return;
      }

      if (!user) {
        setRequiresAuth(true);
        setStatus('Sign in to access your profile.');
        return;
      }

      try {
        await ensureProfile(supabase, user);
      } catch (error) {
        console.error(error);
        setStatus('Could not prepare your profile. Please try again.');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        return;
      }

      if (!profile?.username) {
        setStatus('Profile not found. Please try again.');
        return;
      }

      router.replace(`/profile/${profile.username}`);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Opening your profile</h1>
        <p className="mt-2 text-sm text-ink/70">{status}</p>
      </div>
      {requiresAuth ? (
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href="/login?redirectTo=/profile">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/signup?redirectTo=/profile">Create account</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
