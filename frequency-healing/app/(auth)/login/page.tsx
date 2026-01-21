import { Suspense } from 'react';
import LoginClient from '@/app/(auth)/login/LoginClient';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md text-sm text-ink/70">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
