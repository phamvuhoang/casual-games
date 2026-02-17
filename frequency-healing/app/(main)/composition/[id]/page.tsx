'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AudioPlayer from '@/components/audio/AudioPlayer';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import { AUDIO_BUCKET, THUMBNAIL_BUCKET, VIDEO_BUCKET } from '@/lib/utils/constants';
import { formatFrequencyList } from '@/lib/utils/helpers';
import type { Database } from '@/lib/supabase/types';

type Composition = Database['public']['Tables']['compositions']['Row'];
type CommentRow = Database['public']['Tables']['comments']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type CollectionRow = Database['public']['Tables']['collections']['Row'];
type CommentAuthor = Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_url'>;
type CommentWithAuthor = CommentRow & { author?: CommentAuthor };

function extractStorageObjectPath(publicUrl: string | null, bucket: string) {
  if (!publicUrl) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const pathname = decodeURIComponent(url.pathname);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/object/public/${bucket}/`,
      `/${bucket}/`
    ];

    for (const marker of markers) {
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }

      const rawPath = pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
      if (rawPath) {
        return rawPath;
      }
    }
  } catch (error) {
    console.warn('Unable to parse storage URL.', error);
  }

  return null;
}

export default function CompositionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const [composition, setComposition] = useState<Composition | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isCountingPlay, setIsCountingPlay] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentStatus, setCommentStatus] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionSelections, setCollectionSelections] = useState<string[]>([]);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null);
  const [isUpdatingCollection, setIsUpdatingCollection] = useState(false);
  const [isDeletingComposition, setIsDeletingComposition] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const isEmbedMode = searchParams.get('embed') === '1';

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

  useEffect(() => {
    let isMounted = true;

    const loadCollections = async () => {
      if (!userId || !composition) {
        setCollections([]);
        setCollectionSelections([]);
        return;
      }

      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (collectionError) {
        setCollectionStatus(collectionError.message);
        return;
      }

      const list = collectionData ?? [];
      setCollections(list);

      if (list.length === 0) {
        setCollectionSelections([]);
        return;
      }

      const ids = list.map((collection) => collection.id);
      const { data: itemData, error: itemError } = await supabase
        .from('collection_items')
        .select('collection_id')
        .eq('composition_id', composition.id)
        .in('collection_id', ids);

      if (!isMounted) {
        return;
      }

      if (itemError) {
        setCollectionStatus(itemError.message);
        return;
      }

      setCollectionSelections((itemData ?? []).map((item) => item.collection_id));
    };

    loadCollections();

    return () => {
      isMounted = false;
    };
  }, [composition, supabase, userId]);

  useEffect(() => {
    let isMounted = true;

    const loadComments = async () => {
      if (!id) {
        return;
      }

      setIsLoadingComments(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('composition_id', id)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setCommentStatus(error.message);
        setIsLoadingComments(false);
        return;
      }

      const rows = data ?? [];
      const authorIds = Array.from(
        new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
      );

      let authorMap = new Map<string, CommentAuthor>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds);

        (profiles ?? []).forEach((profile) => {
          authorMap.set(profile.id, profile);
        });
      }

      const combined = rows.map((row) => ({
        ...row,
        author: row.user_id ? authorMap.get(row.user_id) : undefined
      }));

      setComments(combined);
      setIsLoadingComments(false);
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [id, supabase]);

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

  const handleToggleCollection = async (collectionId: string) => {
    if (!composition || !userId || isUpdatingCollection) {
      return;
    }

    setIsUpdatingCollection(true);
    setCollectionStatus(null);

    const isSelected = collectionSelections.includes(collectionId);
    if (isSelected) {
      const { error } = await supabase
        .from('collection_items')
        .delete()
        .eq('collection_id', collectionId)
        .eq('composition_id', composition.id);

      if (error) {
        setCollectionStatus(error.message);
        setIsUpdatingCollection(false);
        return;
      }

      setCollectionSelections((prev) => prev.filter((idValue) => idValue !== collectionId));
      setIsUpdatingCollection(false);
      return;
    }

    const { error } = await supabase.from('collection_items').insert({
      collection_id: collectionId,
      composition_id: composition.id
    });

    if (error) {
      setCollectionStatus(error.message);
      setIsUpdatingCollection(false);
      return;
    }

    setCollectionSelections((prev) => [...prev, collectionId]);
    setIsUpdatingCollection(false);
  };

  const handleSubmitComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed) {
      setCommentStatus('Write a comment before sharing.');
      return;
    }

    if (!userId) {
      setCommentStatus('Sign in to comment.');
      return;
    }

    setIsPostingComment(true);
    setCommentStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const activeUser = userData.user;
    if (!activeUser) {
      setCommentStatus('Sign in to comment.');
      setIsPostingComment(false);
      return;
    }

    try {
      await ensureProfile(supabase, activeUser);
    } catch (error) {
      console.error(error);
      setCommentStatus('We could not verify your profile. Please try again.');
      setIsPostingComment(false);
      return;
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        composition_id: id,
        user_id: activeUser.id,
        content: trimmed
      })
      .select('*')
      .single();

    if (error) {
      setCommentStatus(error.message);
      setIsPostingComment(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', activeUser.id)
      .maybeSingle();

    const nextComment: CommentWithAuthor = {
      ...data,
      author: profileData ?? undefined
    };

    setComments((prev) => [nextComment, ...prev]);
    setCommentInput('');
    setIsPostingComment(false);
  };

  const handlePlay = async () => {
    if (!composition || isCountingPlay) {
      return;
    }

    setIsCountingPlay(true);
    setStatus(null);
    setComposition((prev) =>
      prev ? { ...prev, play_count: (prev.play_count ?? 0) + 1 } : prev
    );

    const { data, error } = await supabase.rpc('increment_play_count', {
      composition_id: composition.id
    });

    if (error) {
      console.warn(error);
      setStatus(error.message);
      setComposition((prev) =>
        prev ? { ...prev, play_count: Math.max(0, (prev.play_count ?? 1) - 1) } : prev
      );
      setIsCountingPlay(false);
      return;
    }

    if (typeof data === 'number') {
      setComposition((prev) => (prev ? { ...prev, play_count: data } : prev));
    }

    setIsCountingPlay(false);
  };

  const handleDeleteComposition = async () => {
    if (!composition || isDeletingComposition) {
      return;
    }

    if (!userId) {
      setDeleteStatus('Sign in to delete your composition.');
      return;
    }

    if (!composition.user_id || composition.user_id !== userId) {
      setDeleteStatus('Only the creator can delete this composition.');
      return;
    }

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(
            'Delete this composition permanently? Audio, video, and thumbnail files will also be removed from storage.'
          );
    if (!confirmed) {
      return;
    }

    setIsDeletingComposition(true);
    setDeleteStatus(null);

    try {
      const mediaTargets: Array<{ bucket: string; url: string | null; label: string }> = [
        { bucket: AUDIO_BUCKET, url: composition.audio_url, label: 'audio' },
        { bucket: VIDEO_BUCKET, url: composition.video_url, label: 'video' },
        { bucket: THUMBNAIL_BUCKET, url: composition.thumbnail_url, label: 'thumbnail' }
      ];

      const pathsByBucket = new Map<string, Set<string>>();

      for (const target of mediaTargets) {
        if (!target.url) {
          continue;
        }

        const parsedPath = extractStorageObjectPath(target.url, target.bucket);
        if (!parsedPath) {
          throw new Error(`Could not parse ${target.label} file path for deletion.`);
        }

        if (!pathsByBucket.has(target.bucket)) {
          pathsByBucket.set(target.bucket, new Set<string>());
        }
        pathsByBucket.get(target.bucket)?.add(parsedPath);
      }

      for (const [bucket, pathSet] of pathsByBucket.entries()) {
        const paths = Array.from(pathSet);
        if (paths.length === 0) {
          continue;
        }

        const { error } = await supabase.storage.from(bucket).remove(paths);
        if (error) {
          throw new Error(`Could not delete media files from ${bucket}: ${error.message}`);
        }
      }

      const { error: deleteError } = await supabase
        .from('compositions')
        .delete()
        .eq('id', composition.id)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      router.push('/profile');
      router.refresh();
    } catch (error) {
      console.error(error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Could not delete composition.';
      setDeleteStatus(message);
    } finally {
      setIsDeletingComposition(false);
    }
  };

  if (!composition) {
    return <p className="text-sm text-ink/70">{status ?? 'Loading composition...'}</p>;
  }

  const formatCommentDate = (value?: string | null) => {
    if (!value) {
      return '';
    }
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  const isOwner = Boolean(userId && composition.user_id && userId === composition.user_id);

  if (isEmbedMode) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <AudioPlayer
          title={composition.title}
          audioUrl={composition.audio_url}
          videoUrl={composition.video_url}
          thumbnailUrl={composition.thumbnail_url}
          sharePath={`/composition/${composition.id}`}
          frequencies={composition.frequencies}
          onPlay={handlePlay}
        />
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-4 text-sm text-ink/70">
          {composition.description?.trim() || 'Listen and reset with this healing session.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Composition</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{composition.title}</h1>
        <p className="mt-2 text-sm text-ink/70">{formatFrequencyList(composition.frequencies)}</p>
      </div>

      <AudioPlayer
        title={composition.title}
        audioUrl={composition.audio_url}
        videoUrl={composition.video_url}
        thumbnailUrl={composition.thumbnail_url}
        sharePath={`/composition/${composition.id}`}
        frequencies={composition.frequencies}
        onPlay={handlePlay}
      />

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

      {isOwner ? (
        <Card className="glass-panel border border-rose-200/70 bg-rose-50/70">
          <h2 className="text-lg font-semibold text-rose-900">Creator tools</h2>
          <p className="mt-3 text-sm text-rose-900/80">
            Delete this composition permanently. Audio, video, and thumbnail files will be physically removed from
            storage.
          </p>
          <Button
            variant="outline"
            onClick={handleDeleteComposition}
            disabled={isDeletingComposition}
            className="mt-4 border-rose-300 bg-white text-rose-700 hover:bg-rose-100"
          >
            {isDeletingComposition ? 'Deleting...' : 'Delete composition'}
          </Button>
          {deleteStatus ? <p className="mt-3 text-sm text-rose-700">{deleteStatus}</p> : null}
        </Card>
      ) : null}

      <Card className="glass-panel">
        <h2 className="text-lg font-semibold">Save to collection</h2>
        {userId ? (
          <div className="mt-4 space-y-3">
            {collections.length === 0 ? (
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4 text-sm text-ink/60">
                No collections yet. Create a playlist from your{' '}
                <Link href="/profile" className="font-semibold text-ink hover:text-ink/80">
                  profile page
                </Link>{' '}
                to organize sessions.
              </div>
            ) : (
              collections.map((collection) => {
                const isSelected = collectionSelections.includes(collection.id);
                return (
                  <div
                    key={collection.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{collection.name}</p>
                      {collection.description ? (
                        <p className="text-xs text-ink/60">{collection.description}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? 'outline' : 'solid'}
                      onClick={() => handleToggleCollection(collection.id)}
                      disabled={isUpdatingCollection}
                    >
                      {isSelected ? 'Remove' : 'Add'}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white/80 p-4">
            <p className="text-sm text-ink/70">Sign in to add this session to your playlists.</p>
            <div className="mt-3">
              <Button asChild size="sm">
                <Link href={`/login?redirectTo=/composition/${composition.id}`}>Sign in to save</Link>
              </Button>
            </div>
          </div>
        )}
        {collectionStatus ? <p className="mt-3 text-sm text-rose-500">{collectionStatus}</p> : null}
      </Card>

      <Card className="glass-panel">
        <h2 className="text-lg font-semibold">Community reflections</h2>
        {userId ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              className="min-h-[100px] w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
              placeholder="Share how this session made you feel..."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSubmitComment} disabled={isPostingComment}>
                {isPostingComment ? 'Posting...' : 'Post comment'}
              </Button>
              <span className="text-xs text-ink/50">Be kind and keep it supportive.</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white/80 p-4">
            <p className="text-sm text-ink/70">Sign in to leave a reflection on this composition.</p>
            <div className="mt-3">
              <Button asChild size="sm">
                <Link href={`/login?redirectTo=/composition/${composition.id}`}>Sign in to comment</Link>
              </Button>
            </div>
          </div>
        )}
        {commentStatus ? <p className="mt-3 text-sm text-rose-500">{commentStatus}</p> : null}
        {isLoadingComments ? <p className="mt-4 text-sm text-ink/60">Loading reflections...</p> : null}
        {!isLoadingComments && comments.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">No reflections yet. Start the conversation.</p>
        ) : null}
        <div className="mt-4 grid gap-4">
          {comments.map((comment) => {
            const displayName =
              comment.author?.display_name ?? comment.author?.username ?? 'Anonymous listener';
            const initials = displayName ? displayName.charAt(0).toUpperCase() : 'A';

            return (
              <div key={comment.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/10 text-xs font-semibold text-ink/70">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-ink/60">{formatCommentDate(comment.created_at)}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-ink/70">{comment.content}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
