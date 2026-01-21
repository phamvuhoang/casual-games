import FrequencyCreator from '@/components/audio/FrequencyCreator';

export default function CreatePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Creator</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Compose a healing frequency session.</h1>
      </div>
      <FrequencyCreator />
    </div>
  );
}
