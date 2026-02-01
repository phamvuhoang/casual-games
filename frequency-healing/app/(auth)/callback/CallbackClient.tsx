'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import { sanitizeRedirect } from '@/lib/utils/redirect';

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const [status, setStatus] = useState('Completing sign-in...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const completeSignIn = async () => {
      const code = searchParams.get('code');
      const redirectTo = sanitizeRedirect(searchParams.get('redirectTo'), '/discover');

      if (!code) {
        try {
          const hash = typeof window !== 'undefined' ? window.location.hash : '';
          const params = new URLSearchParams(hash.replace('#', ''));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (!accessToken || !refreshToken) {
            setStatus('Missing sign-in tokens. Please try again.');
            setHasError(true);
            return;
          }

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (!isMounted) {
            return;
          }

          if (error) {
            setStatus(error.message);
            setHasError(true);
            return;
          }

          if (data?.session?.user) {
            try {
              await ensureProfile(supabase, data.session.user);
            } catch (profileError) {
              console.warn('Profile setup failed.', profileError);
            }
          }

          router.replace(redirectTo);
          return;
        } catch (error) {
          console.error(error);
          setStatus('Missing sign-in code. Please try again.');
          setHasError(true);
          return;
        }
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        setHasError(true);
        return;
      }

      if (data?.session?.user) {
        try {
          await ensureProfile(supabase, data.session.user);
        } catch (profileError) {
          console.warn('Profile setup failed.', profileError);
        }
      }

      router.replace(redirectTo);
    };

    completeSignIn();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams, supabase]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-halo">
        <h1 className="text-2xl font-semibold">Signing you in</h1>
        <p className="mt-3 text-sm text-ink/70">{status}</p>
        {hasError ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/login">Return to sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/discover">Go to Discover</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
