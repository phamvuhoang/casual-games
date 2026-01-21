import { Suspense } from 'react';
import SignupClient from '@/app/(auth)/signup/SignupClient';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md text-sm text-ink/70">Loading...</div>}>
      <SignupClient />
    </Suspense>
  );
}
