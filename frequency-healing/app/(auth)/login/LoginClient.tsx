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

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

export default function LoginClient() {
  const supabase = createSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const [status, setStatus] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setStatus(error.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      try {
        await ensureProfile(supabase, userData.user);
      } catch (profileError) {
        console.warn('Profile setup failed.', profileError);
      }
    }

    setStatus('Signed in. Redirecting...');
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace('/discover');
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Card className="glass-panel">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-ink/70">Enter your credentials to access your healing studio.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        {status ? <p className="mt-4 text-sm text-ink/70">{status}</p> : null}
      </Card>
      <p className="text-center text-sm text-ink/70">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
