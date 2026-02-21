import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

type JourneyPoint = {
  title: string;
  description: string;
};

type SessionIdea = {
  label: string;
  stack: string;
};

type FrequencyCard = {
  label: string;
  value: string;
};

export default async function HomePage() {
  const t = await getTranslations('home');
  const journeyPoints = t.raw('journeyPoints') as JourneyPoint[];
  const quickStartSteps = t.raw('quickStartSteps') as string[];
  const firstSessionIdeas = t.raw('firstSessionIdeas') as SessionIdea[];
  const frequencyCards = t.raw('frequencyCards') as FrequencyCard[];

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 sm:gap-14">
      <section className="relative overflow-hidden rounded-[2.2rem] bg-aurora px-6 py-8 shadow-halo sm:px-10 sm:py-12 md:px-14 md:py-14">
        <div className="absolute inset-0 opacity-50" aria-hidden="true">
          <div className="absolute left-[8%] top-[14%] h-24 w-24 rounded-full border border-white/45" />
          <div className="absolute bottom-[18%] right-[10%] h-36 w-36 rounded-full border border-white/35" />
          <div className="absolute left-1/2 top-[46%] h-20 w-20 -translate-x-1/2 rounded-full border border-white/30" />
        </div>

        <div className="relative z-10 grid gap-5 sm:gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
          <div className="space-y-4 sm:space-y-5">
            <p className="fade-in inline-flex w-fit items-center rounded-full border border-ink/10 bg-white/72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-ink/70">
              {t('harmonicStudio')}
            </p>
            <h1 className="fade-in delay-1 text-[2.15rem] font-semibold leading-tight sm:text-5xl md:text-[3.35rem]">
              {t('title')}
            </h1>
            <p className="fade-in delay-2 max-w-xl text-base text-ink/80 sm:text-lg">{t('description')}</p>
            <div className="fade-in delay-3 flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg">
                <Link href="/create">{t('startListening')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/discover">{t('exploreSessions')}</Link>
              </Button>
            </div>
            <p className="fade-in delay-3 text-xs uppercase tracking-[0.22em] text-ink/60">{t('noAccount')}</p>
            <div className="fade-in delay-3 rounded-2xl border border-ink/10 bg-white/78 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink/60">{t('firstTime')}</p>
              <p className="mt-1 text-sm text-ink/75">{t('firstTimeBody')}</p>
              <div className="mt-3">
                <Button asChild size="lg">
                  <Link href="/create">{t('openInstant')}</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-ink/60">{t('coreFrequencies')}</p>
            <div className="mt-4 grid gap-2.5">
              {frequencyCards.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/78 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-ink/90">{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink/65">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white/80 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/60">{t('starterStacks')}</p>
              <div className="mt-2 grid gap-2">
                {firstSessionIdeas.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs text-ink/75">
                    <span className="font-semibold">{item.label}</span>
                    <span className="uppercase tracking-[0.16em]">{item.stack}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href="/create">{t('startWithStack')}</Link>
                </Button>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink/65">{t('wellnessDisclaimer')}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {journeyPoints.map((item) => (
          <Card key={item.title} className="glass-panel">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-sm text-ink/75">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-ink/60">{t('quickStartTitle')}</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{t('quickStartHeading')}</h2>
            <div className="mt-4 space-y-2">
              {quickStartSteps.map((step) => (
                <p key={step} className="text-sm text-ink/75">
                  {step}
                </p>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg">
              <Link href="/create">{t('openQuick')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/create">{t('openControls')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
