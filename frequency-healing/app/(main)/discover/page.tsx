'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';
import { formatFrequencyList } from '@/lib/utils/helpers';
import type { Database } from '@/lib/supabase/types';

type Composition = Database['public']['Tables']['compositions']['Row'];

export default function DiscoverPage() {
  const supabase = createSupabaseClient();
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCompositions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('compositions')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      setCompositions(data ?? []);
      setLoading(false);
    };

    loadCompositions();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Discover</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Public healing compositions</h1>
          <p className="mt-2 text-sm text-ink/70">Listen to the latest community sessions and find your flow.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/create">Create your own</Link>
        </Button>
      </div>

      {loading ? <p className="text-sm text-ink/70">Loading compositions...</p> : null}
      {status ? <p className="text-sm text-rose-500">{status}</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {compositions.map((composition) => (
          <Card key={composition.id} className="glass-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{composition.title}</h2>
                <p className="text-sm text-ink/60">{formatFrequencyList(composition.frequencies)}</p>
              </div>
              <Link
                href={`/composition/${composition.id}`}
                className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                View
              </Link>
            </div>
            {composition.description ? (
              <p className="mt-3 text-sm text-ink/70">{composition.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink/60">
              <span>{composition.like_count ?? 0} likes</span>
              <span>{composition.play_count ?? 0} plays</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
