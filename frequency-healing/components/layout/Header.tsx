'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';

const links = [
  { label: 'Create', href: '/create' },
  { label: 'Discover', href: '/discover' }
];

export default function Header() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [profilePath, setProfilePath] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createSupabaseClient();

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setEmail(data.user?.email ?? null);
      }
    };

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setEmail(session?.user?.email ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!email) {
        setProfilePath(null);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setProfilePath(null);
        return;
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error || !profileData?.username) {
        setProfilePath('/profile');
        return;
      }

      setProfilePath(`/profile/${profileData.username}`);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [email, supabase]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ember text-lg font-semibold text-white shadow-glow">
            FH
          </div>
          <div className="leading-none">
            <p className="text-sm uppercase tracking-[0.3em] text-ink/60">Frequency</p>
            <p className="text-lg font-semibold">Healing Studio</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink/70 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition ${pathname === link.href ? 'text-ink' : 'hover:text-ink'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          {email ? (
            <div className="hidden rounded-full bg-white/80 px-4 py-2 text-xs text-ink/70 md:block">
              {email}
            </div>
          ) : null}
          {email && profilePath ? (
            <Button asChild variant="outline" size="sm">
              <Link href={profilePath}>Profile</Link>
            </Button>
          ) : null}
          {email ? (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t border-ink/10 bg-white/90 md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 text-sm text-ink/70">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl border border-ink/10 px-4 py-3 transition ${
                  pathname === link.href ? 'bg-white text-ink' : 'bg-white/70 hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {email && profilePath ? (
              <Link
                href={profilePath}
                className={`rounded-2xl border border-ink/10 px-4 py-3 transition ${
                  pathname?.startsWith('/profile') ? 'bg-white text-ink' : 'bg-white/70 hover:text-ink'
                }`}
              >
                Profile
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
