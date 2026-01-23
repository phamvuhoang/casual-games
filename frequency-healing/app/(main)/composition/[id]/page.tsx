'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AudioPlayer from '@/components/audio/AudioPlayer';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createSupabaseClient } from '@/lib/supabase/client';
import { formatFrequencyList } from '@/lib/utils/helpers';
import type { Database } from '@/lib/supabase/types';

type Composition = Database['public']['Tables']['compositions']['Row'];

export default function CompositionPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createSupabaseClient();
  const [composition, setComposition] = useState<Composition | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadComposition = async () => {
      const { data, error } = await supabase.from('compositions').select('*').eq('id', id).single();

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        return;
      }

      setComposition(data);
    };

    if (id) {
      loadComposition();
    }

    return () => {
      isMounted = false;
    };
  }, [id, supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setUserId(data.user?.id ?? null);
      }
    };

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUserId(session?.user?.id ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadLikeState = async () => {
      if (!userId || !id) {
        setHasLiked(false);
        return;
      }

      const { data, error } = await supabase
        .from('composition_likes')
        .select('id')
        .eq('composition_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.warn(error);
        setHasLiked(false);
        return;
      }

      setHasLiked(Boolean(data?.id));
    };

    loadLikeState();

    return () => {
      isMounted = false;
    };
  }, [id, supabase, userId]);

  const handleLike = async () => {
    if (!composition || isLiking) {
      return;
    }

    setIsLiking(true);
    setStatus(null);
    if (!userId) {
      setStatus('Sign in to like compositions.');
      setIsLiking(false);
      return;
    }

    if (hasLiked) {
      const { error } = await supabase
        .from('composition_likes')
        .delete()
        .eq('composition_id', composition.id)
        .eq('user_id', userId);

      if (error) {
        setStatus(error.message);
        setIsLiking(false);
        return;
      }

      const nextLikeCount = Math.max(0, (composition.like_count ?? 0) - 1);
      setComposition({ ...composition, like_count: nextLikeCount });
      setHasLiked(false);
      await supabase.from('compositions').update({ like_count: nextLikeCount }).eq('id', composition.id);
      setIsLiking(false);
      return;
    }

    const { error } = await supabase.from('composition_likes').insert({
      composition_id: composition.id,
      user_id: userId
    });

    if (error) {
      setStatus(error.message);
      setIsLiking(false);
      return;
    }

    const nextLikeCount = (composition.like_count ?? 0) + 1;
    setComposition({ ...composition, like_count: nextLikeCount });
    setHasLiked(true);
    await supabase.from('compositions').update({ like_count: nextLikeCount }).eq('id', composition.id);
    setIsLiking(false);
  };

  if (!composition) {
    return <p className="text-sm text-ink/70">{status ?? 'Loading composition...'}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Composition</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{composition.title}</h1>
        <p className="mt-2 text-sm text-ink/70">{formatFrequencyList(composition.frequencies)}</p>
      </div>

      <AudioPlayer title={composition.title} audioUrl={composition.audio_url} frequencies={composition.frequencies} />

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-panel">
          <h2 className="text-lg font-semibold">Session details</h2>
          {composition.description ? (
            <p className="mt-3 text-sm text-ink/70">{composition.description}</p>
          ) : (
            <p className="mt-3 text-sm text-ink/60">No description provided yet.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink/60">
            <span>Waveform: {composition.waveform ?? 'sine'}</span>
            <span>Duration: {composition.duration ?? 0}s</span>
            <span>Ambient: {composition.ambient_sound ?? 'none'}</span>
          </div>
        </Card>
        <Card className="glass-panel">
          <h2 className="text-lg font-semibold">Community energy</h2>
          <p className="mt-3 text-sm text-ink/70">
            {composition.like_count ?? 0} likes - {composition.play_count ?? 0} plays
          </p>
          <Button onClick={handleLike} disabled={isLiking} className="mt-4">
            {isLiking ? 'Updating...' : hasLiked ? 'Remove appreciation' : 'Send appreciation'}
          </Button>
          {status ? <p className="mt-3 text-sm text-rose-500">{status}</p> : null}
        </Card>
      </div>
    </div>
  );
}
