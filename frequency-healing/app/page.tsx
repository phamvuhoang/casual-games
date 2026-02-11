import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

const journeyPoints = [
  {
    title: 'Set intention',
    description: 'Choose frequencies for grounding, heart coherence, focus, or sleep support.'
  },
  {
    title: 'Shape your field',
    description: 'Layer rhythm, modulation, binaural offset, and ambient texture in one studio flow.'
  },
  {
    title: 'Enter resonance',
    description: 'Pair the session with visual atmospheres tuned for immersive, low-distraction attention.'
  }
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-14">
      <section className="relative overflow-hidden rounded-[2.2rem] bg-aurora px-7 py-10 shadow-halo sm:px-10 sm:py-12 md:px-14 md:py-14">
        <div className="absolute inset-0 opacity-50" aria-hidden="true">
          <div className="absolute left-[8%] top-[14%] h-24 w-24 rounded-full border border-white/45" />
          <div className="absolute bottom-[18%] right-[10%] h-36 w-36 rounded-full border border-white/35" />
          <div className="absolute left-1/2 top-[46%] h-20 w-20 -translate-x-1/2 rounded-full border border-white/30" />
        </div>

        <div className="relative z-10 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
          <div className="space-y-5">
            <p className="fade-in inline-flex w-fit items-center rounded-full border border-ink/10 bg-white/72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-ink/70">
              Harmonic Studio
            </p>
            <h1 className="fade-in delay-1 text-[2.15rem] font-semibold leading-tight sm:text-5xl md:text-[3.35rem]">
              Design healing sound journeys with guided, calming visual space.
            </h1>
            <p className="fade-in delay-2 max-w-xl text-base text-ink/80 sm:text-lg">
              Build intentional frequency sessions, refine advanced audio movement, and enter a responsive meditative
              canvas that stays soft on focus.
            </p>
            <div className="fade-in delay-3 flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg">
                <Link href="/create">Open the Studio</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/discover">Explore Sessions</Link>
              </Button>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Core frequencies</p>
            <div className="mt-4 grid gap-2.5">
              {[
                { label: 'Natural tuning', value: '432 Hz' },
                { label: 'Love / coherence', value: '528 Hz' },
                { label: 'Heart resonance', value: '639 Hz' },
                { label: 'Higher awareness', value: '963 Hz' }
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/78 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-ink/90">{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink/65">{item.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink/65">
              Healing outcomes vary by context and individual response. Use as a wellness companion, not medical
              treatment.
            </p>
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
    </div>
  );
}
