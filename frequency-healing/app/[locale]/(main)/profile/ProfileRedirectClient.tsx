'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';

export default function ProfileRedirectClient() {
  const t = useTranslations('profile.redirect');
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [status, setStatus] = useState(t('loadingProfile'));
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
        setStatus(t('signInRequired'));
        return;
      }

      try {
        await ensureProfile(supabase, user);
      } catch (error) {
        console.error(error);
        setStatus(t('prepareFailed'));
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
        setStatus(t('notFound'));
        return;
      }

      router.replace(`/profile/${profile.username}`);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router, supabase, t]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">{t('label')}</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{t('opening')}</h1>
        <p className="mt-2 text-sm text-ink/70">{status}</p>
      </div>
      {requiresAuth ? (
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href="/login?redirectTo=/profile">{t('signIn')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/signup?redirectTo=/profile">{t('createAccount')}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
