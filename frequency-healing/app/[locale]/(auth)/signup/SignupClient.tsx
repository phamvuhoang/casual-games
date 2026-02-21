'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import { sanitizeRedirect } from '@/lib/utils/redirect';

type FormValues = {
  username: string;
  email: string;
  password: string;
};

export default function SignupClient() {
  const tAuth = useTranslations('auth.signup');
  const tValidation = useTranslations('validation');

  const schema = useMemo(
    () =>
      z.object({
        username: z.string().min(3, tValidation('usernameMin')),
        email: z.string().email(tValidation('emailInvalid')),
        password: z.string().min(6, tValidation('passwordMin'))
      }),
    [tValidation]
  );

  const supabase = createSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectToParam = searchParams.get('redirectTo');
  const safeRedirectTo = sanitizeRedirect(redirectToParam, '/discover');
  const [status, setStatus] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleGoogleSignIn = async () => {
    setStatus(null);
    if (typeof window === 'undefined') {
      return;
    }

    const redirectUrl = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(safeRedirectTo)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(tAuth('redirectingGoogle'));
  };

  const onSubmit = async (values: FormValues) => {
    setStatus(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { username: values.username }
      }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    if (data.session?.user) {
      try {
        await ensureProfile(supabase, data.session.user);
      } catch (profileError) {
        console.warn('Profile setup failed.', profileError);
      }
    }

    setStatus(tAuth('created'));
    await supabase.auth.signOut();
    router.replace(safeRedirectTo);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Card className="glass-panel">
        <h1 className="text-2xl font-semibold">{tAuth('title')}</h1>
        <p className="mt-2 text-sm text-ink/70">{tAuth('description')}</p>
        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            {tAuth('google')}
          </Button>
        </div>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ink/40">
          <span className="h-px flex-1 bg-ink/10" />
          {tAuth('or')}
          <span className="h-px flex-1 bg-ink/10" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">{tAuth('username')}</label>
            <input
              {...register('username')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.username ? <p className="mt-1 text-xs text-rose-500">{errors.username.message}</p> : null}
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">{tAuth('email')}</label>
            <input
              {...register('email')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p> : null}
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">{tAuth('password')}</label>
            <input
              type="password"
              {...register('password')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.password ? <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? tAuth('submitting') : tAuth('submit')}
          </Button>
        </form>
        {status ? <p className="mt-4 text-sm text-ink/70">{status}</p> : null}
      </Card>
      <p className="text-center text-sm text-ink/70">
        {tAuth('already')}{' '}
        <Link
          href={safeRedirectTo ? `/login?redirectTo=${encodeURIComponent(safeRedirectTo)}` : '/login'}
          className="font-semibold text-ink"
        >
          {tAuth('signIn')}
        </Link>
      </p>
    </div>
  );
}
