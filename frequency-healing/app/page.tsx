import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16">
      <section className="relative overflow-hidden rounded-[32px] bg-aurora p-10 shadow-halo md:p-16">
        <div className="absolute inset-0 opacity-40" aria-hidden="true">
          <div className="absolute left-6 top-6 h-24 w-24 rounded-full border border-white/60" />
          <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full border border-white/40" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
        </div>
        <div className="relative z-10 grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <p className="fade-in inline-flex w-fit items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink/70">
              Resonance Lab
            </p>
            <h1 className="fade-in delay-1 text-4xl font-semibold leading-tight md:text-6xl">
              Sculpt healing frequencies into immersive sound + light experiences.
            </h1>
            <p className="fade-in delay-2 text-base text-ink/80 md:text-lg">
              Blend solfeggio tones, ambient textures, and meditative visuals. Capture a living composition you can
              share, replay, and evolve.
            </p>
            <div className="fade-in delay-3 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/create">Start a composition</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/discover">Explore the library</Link>
              </Button>
            </div>
          </div>
          <div className="glass-panel relative flex flex-col gap-6 rounded-3xl p-6 shadow-glow">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Featured frequencies</p>
              <h2 className="mt-3 text-2xl font-semibold">Tuned for calm, clarity, and connection.</h2>
            </div>
            <div className="grid gap-3">
              {[
                { label: 'Natural Tuning', value: '432 Hz' },
                { label: 'Love / Miracle', value: '528 Hz' },
                { label: 'Heart Connection', value: '639 Hz' },
                { label: 'Awakening', value: '963 Hz' }
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-ink/60">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Design soundscapes',
            description: 'Select sacred frequencies, sculpt waveforms, and layer ambient textures in real time.'
          },
          {
            title: 'See the resonance',
            description: 'Audio-reactive visuals bloom with every harmonic, from waveforms to ethereal particles.'
          },
          {
            title: 'Share the ritual',
            description: 'Publish your compositions, gather feedback, and build a personal healing library.'
          }
        ].map((card) => (
          <Card key={card.title} className="glass-panel">
            <h3 className="text-xl font-semibold">{card.title}</h3>
            <p className="mt-3 text-sm text-ink/70">{card.description}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
