'use client';

import { usePathname } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/helpers';

const links = [
  { key: 'create', href: '/create' },
  { key: 'discover', href: '/discover' }
] as const;

export default function Header() {
  const t = useTranslations('common.header');
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
    <header className="fixed left-0 right-0 top-0 z-40 px-4 pt-3 sm:px-6 md:px-10">
      <div className="mx-auto flex w-full max-w-[1220px] items-center justify-between rounded-[1.8rem] border border-white/35 bg-white/70 px-4 py-3 shadow-[0_18px_48px_rgba(44,28,80,0.15)] backdrop-blur-xl md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b78d7] via-[#6b99cd] to-[#72afb4] text-lg font-semibold text-white shadow-[0_10px_20px_rgba(73,69,133,0.35)]">
            FH
          </div>
          <div className="leading-none">
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink/60">{t('brandTop')}</p>
            <p className="text-lg font-semibold">{t('brandBottom')}</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-medium text-ink/70 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-4 py-2 transition',
                pathname === link.href ? 'bg-white text-ink shadow-sm' : 'text-ink/70 hover:bg-white/70 hover:text-ink'
              )}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="desktop" className="hidden md:flex" />
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70 md:hidden"
            aria-expanded={menuOpen}
            aria-label={t('toggleNavigation')}
          >
            {t('menu')}
          </button>
          {email ? (
            <div className="hidden rounded-full border border-ink/12 bg-white/82 px-4 py-2 text-xs text-ink/70 md:block">
              {t('authEmail', { email })}
            </div>
          ) : null}
          {email && profilePath ? (
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
              <Link href={profilePath}>{t('profile')}</Link>
            </Button>
          ) : null}
          {email ? (
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden md:inline-flex">
              {t('signOut')}
            </Button>
          ) : (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/login">{t('signIn')}</Link>
            </Button>
          )}
        </div>
      </div>
      {menuOpen ? (
        <div className="mx-auto mt-2 w-full max-w-[1220px] rounded-3xl border border-white/35 bg-white/88 p-3 shadow-[0_14px_34px_rgba(24,28,44,0.14)] backdrop-blur md:hidden">
          <LanguageSwitcher variant="mobile" className="mb-3" />
          <div className="flex w-full flex-col gap-3 text-sm text-ink/70">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl border border-ink/10 px-4 py-3 transition ${
                  pathname === link.href ? 'bg-white text-ink shadow-sm' : 'bg-white/70 hover:text-ink'
                }`}
              >
                {t(link.key)}
              </Link>
            ))}
            {email && profilePath ? (
              <Link
                href={profilePath}
                className={`rounded-2xl border border-ink/10 px-4 py-3 transition ${
                  pathname?.startsWith('/profile') ? 'bg-white text-ink' : 'bg-white/70 hover:text-ink'
                }`}
              >
                {t('profile')}
              </Link>
            ) : null}
            {email ? (
              <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full">
                {t('signOut')}
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full">
                <Link href="/login">{t('signIn')}</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
