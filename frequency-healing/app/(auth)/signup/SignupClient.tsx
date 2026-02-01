'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import { sanitizeRedirect } from '@/lib/utils/redirect';

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

export default function SignupClient() {
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

    setStatus('Redirecting to Google...');
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

    setStatus('Account created. Redirecting to Discover.');
    await supabase.auth.signOut();
    router.replace(safeRedirectTo);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Card className="glass-panel">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-ink/70">Start building your healing frequency library.</p>
        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Continue with Google
          </Button>
        </div>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ink/40">
          <span className="h-px flex-1 bg-ink/10" />
          or
          <span className="h-px flex-1 bg-ink/10" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Username</label>
            <input
              {...register('username')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.username ? <p className="mt-1 text-xs text-rose-500">{errors.username.message}</p> : null}
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Email</label>
            <input
              {...register('email')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p> : null}
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Password</label>
            <input
              type="password"
              {...register('password')}
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
            />
            {errors.password ? <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        {status ? <p className="mt-4 text-sm text-ink/70">{status}</p> : null}
      </Card>
      <p className="text-center text-sm text-ink/70">
        Already have an account?{' '}
        <Link
          href={safeRedirectTo ? `/login?redirectTo=${encodeURIComponent(safeRedirectTo)}` : '/login'}
          className="font-semibold text-ink"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
