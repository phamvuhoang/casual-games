'use client';

import { useEffect, useMemo, useState } from 'react';
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
type VoiceProfileRow = Database['public']['Tables']['voice_profiles']['Row'];

interface VoiceHistoryEntry {
  id: string;
  createdAt: string;
  capturedAt: string;
  confidence: number;
  captureDurationMs: number;
  analysisDurationMs: number;
  dominantFrequencies: number[];
  recommendedFrequencies: number[];
  bandEnergy: {
    low: number;
    mid: number;
    upperMid: number;
    high: number;
  };
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNumberArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : null))
    .filter((item): item is number => item !== null)
    .slice(0, max);
}

function toRecommendationFrequencies(value: unknown, max = 6) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const object = asObject(entry);
      return object ? asNumber(object.frequency, NaN) : NaN;
    })
    .filter((item) => Number.isFinite(item))
    .slice(0, max);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatHz(values: number[]) {
  if (values.length === 0) {
    return 'None';
  }
  return values.map((value) => `${Math.round(value)}Hz`).join(', ');
}

function formatPercent(value: number) {
  return `${Math.round(clamp(0, value, 1) * 100)}%`;
}

function formatSignedPercent(value: number) {
  const scaled = Math.round(value * 100);
  if (scaled > 0) {
    return `+${scaled}%`;
  }
  return `${scaled}%`;
}

function parseVoiceHistoryEntry(row: VoiceProfileRow): VoiceHistoryEntry {
  const profile = asObject(row.profile);
  const bandEnergy = asObject(profile?.bandEnergy);

  const createdAt = row.created_at ?? new Date().toISOString();
  const capturedAt = typeof profile?.capturedAt === 'string' ? profile.capturedAt : createdAt;

  return {
    id: row.id,
    createdAt,
    capturedAt,
    confidence: clamp(0, asNumber(row.confidence, asNumber(profile?.confidence, 0)), 1),
    captureDurationMs: Math.max(0, asNumber(row.capture_duration_ms, asNumber(profile?.captureDurationMs, 0))),
    analysisDurationMs: Math.max(0, asNumber(row.analysis_duration_ms, asNumber(profile?.analysisDurationMs, 0))),
    dominantFrequencies: toNumberArray(profile?.dominantFrequencies),
    recommendedFrequencies: toRecommendationFrequencies(profile?.recommendations),
    bandEnergy: {
      low: Math.max(0, asNumber(bandEnergy?.low, 0)),
      mid: Math.max(0, asNumber(bandEnergy?.mid, 0)),
      upperMid: Math.max(0, asNumber(bandEnergy?.upperMid, 0)),
      high: Math.max(0, asNumber(bandEnergy?.high, 0))
    }
  };
}

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
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryEntry[]>([]);
  const [voiceHistoryStatus, setVoiceHistoryStatus] = useState<string | null>(null);
  const [compareCurrentId, setCompareCurrentId] = useState('');
  const [compareBaselineId, setCompareBaselineId] = useState('');

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

  useEffect(() => {
    let isMounted = true;

    const loadVoiceHistory = async () => {
      if (!profile || !isOwner) {
        setVoiceHistory([]);
        setVoiceHistoryStatus(null);
        setCompareCurrentId('');
        setCompareBaselineId('');
        return;
      }

      setVoiceHistoryStatus(null);

      const { data, error } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (!isMounted) {
        return;
      }

      if (error) {
        setVoiceHistory([]);
        setVoiceHistoryStatus(error.message);
        return;
      }

      const parsed = (data ?? []).map(parseVoiceHistoryEntry);
      setVoiceHistory(parsed);
      setCompareCurrentId(parsed[0]?.id ?? '');
      setCompareBaselineId(parsed[1]?.id ?? parsed[0]?.id ?? '');
    };

    loadVoiceHistory();

    return () => {
      isMounted = false;
    };
  }, [isOwner, profile, supabase]);

  const latestVoiceProfile = voiceHistory[0] ?? null;
  const previousVoiceProfile = voiceHistory[1] ?? null;
  const latestConfidenceDelta =
    latestVoiceProfile && previousVoiceProfile
      ? latestVoiceProfile.confidence - previousVoiceProfile.confidence
      : null;

  const compareCurrent = useMemo(
    () => voiceHistory.find((entry) => entry.id === compareCurrentId) ?? voiceHistory[0] ?? null,
    [voiceHistory, compareCurrentId]
  );
  const compareBaseline = useMemo(
    () => voiceHistory.find((entry) => entry.id === compareBaselineId) ?? voiceHistory[1] ?? voiceHistory[0] ?? null,
    [voiceHistory, compareBaselineId]
  );

  const canCompare =
    Boolean(compareCurrent) && Boolean(compareBaseline) && compareCurrent?.id !== compareBaseline?.id;
  const compareConfidenceDelta =
    canCompare && compareCurrent && compareBaseline
      ? compareCurrent.confidence - compareBaseline.confidence
      : null;
  const compareLowDelta =
    canCompare && compareCurrent && compareBaseline
      ? compareCurrent.bandEnergy.low - compareBaseline.bandEnergy.low
      : null;
  const compareMidDelta =
    canCompare && compareCurrent && compareBaseline
      ? compareCurrent.bandEnergy.mid - compareBaseline.bandEnergy.mid
      : null;
  const compareUpperMidDelta =
    canCompare && compareCurrent && compareBaseline
      ? compareCurrent.bandEnergy.upperMid - compareBaseline.bandEnergy.upperMid
      : null;
  const compareHighDelta =
    canCompare && compareCurrent && compareBaseline
      ? compareCurrent.bandEnergy.high - compareBaseline.bandEnergy.high
      : null;

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

      {isOwner ? (
        <Card className="glass-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Voice Bioprint History</h2>
              <p className="text-sm text-ink/60">
                Private capture history from your voice profile sessions, with trend comparisons.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-ink/50">
              {voiceHistory.length} captures
            </span>
          </div>

          {voiceHistoryStatus ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {voiceHistoryStatus}
            </p>
          ) : null}

          {voiceHistory.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/60">
              <p>No voice profiles yet. Create one from the Voice Bioprint panel in Creator.</p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/create">Open Creator</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Latest confidence</p>
                  <p className="mt-1 text-lg font-semibold text-ink/85">
                    {latestVoiceProfile ? formatPercent(latestVoiceProfile.confidence) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Capture trend</p>
                  <p className="mt-1 text-lg font-semibold text-ink/85">
                    {latestConfidenceDelta !== null ? formatSignedPercent(latestConfidenceDelta) : 'N/A'}
                  </p>
                  <p className="text-xs text-ink/55">Compared to previous profile</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Last captured</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {latestVoiceProfile ? formatDateTime(latestVoiceProfile.capturedAt) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-ink/10 bg-white/75 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Compare trends</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-ink/70">
                    <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-ink/55">Current</span>
                    <select
                      value={compareCurrentId}
                      onChange={(event) => setCompareCurrentId(event.target.value)}
                      className="w-full rounded-2xl border border-ink/10 bg-white/90 px-3 py-2 text-sm"
                    >
                      {voiceHistory.map((entry) => (
                        <option key={`current-${entry.id}`} value={entry.id}>
                          {formatDateTime(entry.capturedAt)} ({formatPercent(entry.confidence)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-ink/70">
                    <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-ink/55">Baseline</span>
                    <select
                      value={compareBaselineId}
                      onChange={(event) => setCompareBaselineId(event.target.value)}
                      className="w-full rounded-2xl border border-ink/10 bg-white/90 px-3 py-2 text-sm"
                    >
                      {voiceHistory.map((entry) => (
                        <option key={`baseline-${entry.id}`} value={entry.id}>
                          {formatDateTime(entry.capturedAt)} ({formatPercent(entry.confidence)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {canCompare ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Confidence delta</p>
                      <p className="mt-1 font-semibold text-ink/85">
                        {compareConfidenceDelta !== null ? formatSignedPercent(compareConfidenceDelta) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Band energy delta</p>
                      <p className="mt-1 text-xs text-ink/70">
                        Low: {compareLowDelta !== null ? formatSignedPercent(compareLowDelta) : 'N/A'} | Mid:{' '}
                        {compareMidDelta !== null ? formatSignedPercent(compareMidDelta) : 'N/A'}
                      </p>
                      <p className="text-xs text-ink/70">
                        Upper-mid: {compareUpperMidDelta !== null ? formatSignedPercent(compareUpperMidDelta) : 'N/A'} | High:{' '}
                        {compareHighDelta !== null ? formatSignedPercent(compareHighDelta) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Current dominant tones</p>
                      <p className="mt-1 text-xs text-ink/75">
                        {compareCurrent ? formatHz(compareCurrent.dominantFrequencies) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Current recommendations</p>
                      <p className="mt-1 text-xs text-ink/75">
                        {compareCurrent ? formatHz(compareCurrent.recommendedFrequencies) : 'N/A'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink/60">Select two different captures to compare trends.</p>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {voiceHistory.map((entry, index) => (
                  <div key={entry.id} className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink/85">
                        Capture #{voiceHistory.length - index} · {formatDateTime(entry.capturedAt)}
                      </p>
                      <span className="text-xs text-ink/60">
                        Confidence {formatPercent(entry.confidence)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">
                      Dominant: {formatHz(entry.dominantFrequencies)} | Recommended: {formatHz(entry.recommendedFrequencies)}
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      Low {formatPercent(entry.bandEnergy.low)} · Mid {formatPercent(entry.bandEnergy.mid)} · Upper-mid{' '}
                      {formatPercent(entry.bandEnergy.upperMid)} · High {formatPercent(entry.bandEnergy.high)}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      Capture {Math.round(entry.captureDurationMs / 1000)}s · Analysis {entry.analysisDurationMs}ms
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}

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
