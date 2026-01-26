'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatFrequencyList } from '@/lib/utils/helpers';
import Link from 'next/link';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Composition = Database['public']['Tables']['compositions']['Row'];
type Collection = Database['public']['Tables']['collections']['Row'];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const supabase = createSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionPublic, setCollectionPublic] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadViewer = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setViewerId(data.user?.id ?? null);
      }
    };

    loadViewer();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setViewerId(session?.user?.id ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setIsOwner(Boolean(profile && viewerId && profile.id === viewerId));
  }, [profile, viewerId]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileDisplayName(profile.display_name ?? '');
    setProfileBio(profile.bio ?? '');
    setProfileAvatarUrl(profile.avatar_url ?? '');
  }, [profile]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setCollectionStatus(null);
      setCollectionCounts({});
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!isMounted) {
        return;
      }

      if (profileError) {
        setStatus(profileError.message);
        return;
      }

      setProfile(profileData);

      const { data: compositionData } = await supabase
        .from('compositions')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (compositionData) {
        setCompositions(compositionData);
      }

      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (collectionError) {
        setCollectionStatus(collectionError.message);
      }

      const collectionsList = collectionData ?? [];
      setCollections(collectionsList);

      if (collectionsList.length > 0) {
        const ids = collectionsList.map((collection) => collection.id);
        const { data: items } = await supabase
          .from('collection_items')
          .select('collection_id')
          .in('collection_id', ids);

        const counts: Record<string, number> = {};
        (items ?? []).forEach((item) => {
          counts[item.collection_id] = (counts[item.collection_id] ?? 0) + 1;
        });
        setCollectionCounts(counts);
      } else {
        setCollectionCounts({});
      }
    };

    if (username) {
      loadProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [supabase, username]);

  const handleCreateCollection = async () => {
    if (!profile || !viewerId || !isOwner) {
      setCollectionStatus('Only the profile owner can create collections.');
      return;
    }

    const trimmedName = collectionName.trim();
    if (!trimmedName) {
      setCollectionStatus('Collection name is required.');
      return;
    }

    setIsCreatingCollection(true);
    setCollectionStatus(null);

    const { data, error } = await supabase
      .from('collections')
      .insert({
        user_id: profile.id,
        name: trimmedName,
        description: collectionDescription.trim() || null,
        is_public: collectionPublic
      })
      .select('*')
      .single();

    if (error) {
      setCollectionStatus(error.message);
      setIsCreatingCollection(false);
      return;
    }

    setCollections((prev) => [data, ...prev]);
    setCollectionCounts((prev) => ({ ...prev, [data.id]: 0 }));
    setCollectionName('');
    setCollectionDescription('');
    setCollectionPublic(false);
    setIsCreatingCollection(false);
  };

  const handleSaveProfile = async () => {
    if (!profile || !isOwner) {
      return;
    }

    setIsSavingProfile(true);
    setProfileStatus(null);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: profileDisplayName.trim() || null,
        bio: profileBio.trim() || null,
        avatar_url: profileAvatarUrl.trim() || null
      })
      .eq('id', profile.id)
      .select('*')
      .single();

    if (error) {
      setProfileStatus(error.message);
      setIsSavingProfile(false);
      return;
    }

    setProfile(data);
    setProfileStatus('Profile updated.');
    setIsSavingProfile(false);
  };

  if (!profile) {
    return <p className="text-sm text-ink/70">{status ?? 'Loading profile...'}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60">Profile</p>
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              className="h-16 w-16 rounded-full border border-ink/10 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ink/10 bg-white/80 text-lg font-semibold text-ink/70">
              {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">{profile.display_name ?? profile.username}</h1>
            {profile.bio ? <p className="mt-1 text-sm text-ink/70">{profile.bio}</p> : null}
          </div>
        </div>
      </div>

      {isOwner ? (
        <Card className="glass-panel">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Display name</label>
            <input
              value={profileDisplayName}
              onChange={(event) => setProfileDisplayName(event.target.value)}
              className="rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm"
            />
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Avatar URL</label>
            <input
              value={profileAvatarUrl}
              onChange={(event) => setProfileAvatarUrl(event.target.value)}
              className="rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm"
            />
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Bio</label>
            <textarea
              value={profileBio}
              onChange={(event) => setProfileBio(event.target.value)}
              className="min-h-[100px] rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm"
            />
            <Button size="sm" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving...' : 'Save profile'}
            </Button>
            {profileStatus ? <p className="text-sm text-ink/60">{profileStatus}</p> : null}
          </div>
        </Card>
      ) : null}

      <Card className="glass-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Collections</h2>
            <p className="text-sm text-ink/60">Curated playlists of healing sessions.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-ink/50">
            {collections.length} total
          </span>
        </div>

        {isOwner ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
            <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Create new collection</label>
            <input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="Collection name"
              className="rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm"
            />
            <textarea
              value={collectionDescription}
              onChange={(event) => setCollectionDescription(event.target.value)}
              placeholder="Description (optional)"
              className="min-h-[80px] rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm"
            />
            <label className="flex items-center justify-between text-sm">
              <span>Make public</span>
              <input
                type="checkbox"
                checked={collectionPublic}
                onChange={(event) => setCollectionPublic(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <Button size="sm" onClick={handleCreateCollection} disabled={isCreatingCollection}>
              {isCreatingCollection ? 'Creating...' : 'Create collection'}
            </Button>
            {collectionStatus ? <p className="text-sm text-rose-500">{collectionStatus}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {collections.map((collection) => (
            <Card key={collection.id} className="glass-panel border border-ink/10">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{collection.name}</h3>
                <span className="text-xs text-ink/60">
                  {collectionCounts[collection.id] ?? 0} sessions
                </span>
              </div>
              {collection.description ? (
                <p className="mt-2 text-sm text-ink/70">{collection.description}</p>
              ) : null}
              <p className="mt-3 text-xs text-ink/50">
                {collection.is_public ? 'Public playlist' : 'Private playlist'}
              </p>
            </Card>
          ))}
          {collections.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/60">
              No collections yet. Curate your favorites to build a playlist.
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {compositions.map((composition) => (
          <Card key={composition.id} className="glass-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{composition.title}</h2>
                <p className="text-xs text-ink/60">{formatFrequencyList(composition.frequencies)}</p>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
