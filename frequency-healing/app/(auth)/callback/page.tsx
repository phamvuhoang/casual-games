import { Suspense } from 'react';
import CallbackClient from '@/app/(auth)/callback/CallbackClient';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-halo">
            <h1 className="text-2xl font-semibold">Signing you in</h1>
            <p className="mt-3 text-sm text-ink/70">Completing sign-in...</p>
          </div>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
