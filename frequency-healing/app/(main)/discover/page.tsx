'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';
import { formatFrequencyList } from '@/lib/utils/helpers';
import type { Database } from '@/lib/supabase/types';

type Composition = Database['public']['Tables']['compositions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileSnippet = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

const PAGE_SIZE = 50;
const SORT_OPTIONS = {
  latest: 'Latest',
  popular: 'Popular'
} as const;

export default function DiscoverPage() {
  const supabase = createSupabaseClient();
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortMode, setSortMode] = useState<keyof typeof SORT_OPTIONS>('latest');
  const [tagFilter, setTagFilter] = useState('all');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, ProfileSnippet>>({});

  useEffect(() => {
    let isMounted = true;

    const loadCompositions = async () => {
      setLoading(true);
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      let query = supabase
        .from('compositions')
        .select('*', { count: 'exact' })
        .eq('is_public', true);

      if (tagFilter !== 'all') {
        query = query.contains('tags', [tagFilter]);
      }

      if (sortMode === 'popular') {
        query = query
          .order('like_count', { ascending: false })
          .order('play_count', { ascending: false })
          .order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query.range(start, end);

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      setCompositions(rows);
      setTotalCount(count ?? 0);
      setCreatorMap({});

      const creatorIds = Array.from(
        new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
      );

      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', creatorIds);

        const map: Record<string, ProfileSnippet> = {};
        (creators ?? []).forEach((creator) => {
          map[creator.id] = creator;
        });
        setCreatorMap(map);
      }

      setLoading(false);
    };

    loadCompositions();

    return () => {
      isMounted = false;
    };
  }, [page, sortMode, supabase, tagFilter]);

  useEffect(() => {
    let isMounted = true;

    const loadTags = async () => {
      const { data, error } = await supabase
        .from('compositions')
        .select('tags')
        .eq('is_public', true)
        .limit(200);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.warn(error);
        return;
      }

      const tagSet = new Set<string>();
      (data ?? []).forEach((row) => {
        (row.tags ?? []).forEach((tag) => {
          if (tag) {
            tagSet.add(tag);
          }
        });
      });

      setAvailableTags(Array.from(tagSet).sort());
    };

    loadTags();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    setPage(1);
  }, [sortMode, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-3">
          <span className="text-ink/60">Sort</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as keyof typeof SORT_OPTIONS)}
            className="rounded-full border border-ink/10 bg-white px-3 py-2"
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3">
          <span className="text-ink/60">Tag</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="rounded-full border border-ink/10 bg-white px-3 py-2"
          >
            <option value="all">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="text-sm text-ink/70">Loading compositions...</p> : null}
      {status ? <p className="text-sm text-rose-500">{status}</p> : null}
      {!loading && !status && compositions.length === 0 ? (
        <p className="text-sm text-ink/70">No compositions match those filters yet.</p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {compositions.map((composition) => (
          <Card key={composition.id} className="glass-panel">
            {(() => {
              const creator = composition.user_id ? creatorMap[composition.user_id] : null;
              if (!creator) {
                return null;
              }
              const displayName = creator.display_name ?? creator.username ?? 'Unknown';
              return (
                <div className="mb-2 text-xs text-ink/60">
                  By{' '}
                  {creator.username ? (
                    <Link href={`/profile/${creator.username}`} className="font-semibold text-ink hover:text-ink/80">
                      {displayName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{displayName}</span>
                  )}
                </div>
              );
            })()}
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

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>
          <span className="text-ink/60">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages || loading}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
