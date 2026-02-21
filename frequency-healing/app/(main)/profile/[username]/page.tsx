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
type BreathSessionRow = Database['public']['Tables']['breath_sessions']['Row'];
type HarmonicFieldSessionRow = Database['public']['Tables']['harmonic_field_sessions']['Row'];
type IntentionImprintRow = Database['public']['Tables']['intention_imprints']['Row'];

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

interface HarmonicFieldHistoryEntry {
  id: string;
  createdAt: string;
  presetId: string;
  intensity: number;
  includeInterference: boolean;
  spatialMotionEnabled: boolean;
  motionSpeed: number;
  layerFrequencies: number[];
  interferenceFrequencies: number[];
}

interface BreathSessionHistoryEntry {
  id: string;
  createdAt: string;
  mode: string;
  targetBpm: number;
  averageBreathBpm: number;
  coherenceScore: number;
  peakCoherenceScore: number;
  timeInCoherencePct: number;
  inhaleRatio: number;
  sensitivity: number;
  sampleCount: number;
}

interface IntentionImprintHistoryEntry {
  id: string;
  createdAt: string;
  intentionText: string;
  extractedKeywords: string[];
  mappedFrequencies: number[];
  mappingConfidence: number;
  modulationRateHz: number;
  modulationDepthHz: number;
  ritualIntensity: number;
  certificateSeed: string | null;
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

function formatKeywords(values: string[]) {
  if (values.length === 0) {
    return 'None';
  }
  return values.join(', ');
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

function parseHarmonicFieldHistoryEntry(row: HarmonicFieldSessionRow): HarmonicFieldHistoryEntry {
  return {
    id: row.id,
    createdAt: row.created_at ?? new Date().toISOString(),
    presetId: row.preset_id || 'unknown',
    intensity: clamp(0.2, asNumber(row.intensity, 0.72), 1),
    includeInterference: Boolean(row.include_interference),
    spatialMotionEnabled: Boolean(row.spatial_motion_enabled),
    motionSpeed: clamp(0.1, asNumber(row.motion_speed, 0.5), 1),
    layerFrequencies: toNumberArray(row.layer_frequencies, 32),
    interferenceFrequencies: toNumberArray(row.interference_frequencies, 24)
  };
}

function parseBreathSessionHistoryEntry(row: BreathSessionRow): BreathSessionHistoryEntry {
  return {
    id: row.id,
    createdAt: row.created_at ?? new Date().toISOString(),
    mode: row.mode || 'manual',
    targetBpm: clamp(3, asNumber(row.target_bpm, 5.5), 9),
    averageBreathBpm: clamp(0, asNumber(row.average_breath_bpm, 0), 30),
    coherenceScore: clamp(0, asNumber(row.coherence_score, 0), 1),
    peakCoherenceScore: clamp(0, asNumber(row.peak_coherence_score, 0), 1),
    timeInCoherencePct: clamp(0, asNumber(row.time_in_coherence_pct, 0), 1),
    inhaleRatio: clamp(0.2, asNumber(row.inhale_ratio, 0.45), 0.8),
    sensitivity: clamp(0.1, asNumber(row.sensitivity, 0.7), 1),
    sampleCount: Math.max(0, Math.round(asNumber(row.sample_count, 0)))
  };
}

function parseIntentionImprintHistoryEntry(row: IntentionImprintRow): IntentionImprintHistoryEntry {
  const mapping = asObject(row.mapping);
  const mappingKeywords = Array.isArray(mapping?.keywords)
    ? mapping.keywords
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter((value) => value.length > 0)
    : [];
  const rowKeywords = Array.isArray(row.extracted_keywords)
    ? row.extracted_keywords
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter((value) => value.length > 0)
    : [];
  const extractedKeywords = (rowKeywords.length > 0 ? rowKeywords : mappingKeywords).slice(0, 12);

  const mappingFrequencies = toNumberArray(mapping?.mappedFrequencies, 12);
  const rowFrequencies = toNumberArray(row.mapped_frequencies, 12);
  const mappedFrequencies = (rowFrequencies.length > 0 ? rowFrequencies : mappingFrequencies).slice(0, 12);

  const intentionText =
    typeof row.intention_text === 'string' && row.intention_text.trim().length > 0
      ? row.intention_text
      : typeof mapping?.intentionText === 'string'
        ? mapping.intentionText
        : '';

  return {
    id: row.id,
    createdAt: row.created_at ?? new Date().toISOString(),
    intentionText,
    extractedKeywords,
    mappedFrequencies,
    mappingConfidence: clamp(0, asNumber(row.mapping_confidence, asNumber(mapping?.mappingConfidence, 0)), 1),
    modulationRateHz: clamp(0.05, asNumber(row.modulation_rate_hz, asNumber(mapping?.modulationRateHz, 0.22)), 8),
    modulationDepthHz: clamp(0.5, asNumber(row.modulation_depth_hz, asNumber(mapping?.modulationDepthHz, 7.4)), 60),
    ritualIntensity: clamp(0.1, asNumber(row.ritual_intensity, asNumber(mapping?.ritualIntensity, 0.45)), 1),
    certificateSeed:
      typeof row.certificate_seed === 'string'
        ? row.certificate_seed
        : typeof mapping?.certificateSeed === 'string'
          ? mapping.certificateSeed
          : null
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
  const [breathHistory, setBreathHistory] = useState<BreathSessionHistoryEntry[]>([]);
  const [breathHistoryStatus, setBreathHistoryStatus] = useState<string | null>(null);
  const [harmonicHistory, setHarmonicHistory] = useState<HarmonicFieldHistoryEntry[]>([]);
  const [harmonicHistoryStatus, setHarmonicHistoryStatus] = useState<string | null>(null);
  const [intentionHistory, setIntentionHistory] = useState<IntentionImprintHistoryEntry[]>([]);
  const [intentionHistoryStatus, setIntentionHistoryStatus] = useState<string | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    const loadHarmonicHistory = async () => {
      if (!profile || !isOwner) {
        setHarmonicHistory([]);
        setHarmonicHistoryStatus(null);
        return;
      }

      setHarmonicHistoryStatus(null);

      const { data, error } = await supabase
        .from('harmonic_field_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (!isMounted) {
        return;
      }

      if (error) {
        setHarmonicHistory([]);
        setHarmonicHistoryStatus(error.message);
        return;
      }

      setHarmonicHistory((data ?? []).map(parseHarmonicFieldHistoryEntry));
    };

    loadHarmonicHistory();

    return () => {
      isMounted = false;
    };
  }, [isOwner, profile, supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadBreathHistory = async () => {
      if (!profile || !isOwner) {
        setBreathHistory([]);
        setBreathHistoryStatus(null);
        return;
      }

      setBreathHistoryStatus(null);

      const { data, error } = await supabase
        .from('breath_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (!isMounted) {
        return;
      }

      if (error) {
        setBreathHistory([]);
        setBreathHistoryStatus(error.message);
        return;
      }

      setBreathHistory((data ?? []).map(parseBreathSessionHistoryEntry));
    };

    loadBreathHistory();

    return () => {
      isMounted = false;
    };
  }, [isOwner, profile, supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadIntentionHistory = async () => {
      if (!profile || !isOwner) {
        setIntentionHistory([]);
        setIntentionHistoryStatus(null);
        return;
      }

      setIntentionHistoryStatus(null);

      const { data, error } = await supabase
        .from('intention_imprints')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (!isMounted) {
        return;
      }

      if (error) {
        setIntentionHistory([]);
        setIntentionHistoryStatus(error.message);
        return;
      }

      setIntentionHistory((data ?? []).map(parseIntentionImprintHistoryEntry));
    };

    loadIntentionHistory();

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
  const latestBreathSession = breathHistory[0] ?? null;
  const previousBreathSession = breathHistory[1] ?? null;
  const breathCoherenceDelta =
    latestBreathSession && previousBreathSession
      ? latestBreathSession.coherenceScore - previousBreathSession.coherenceScore
      : null;
  const breathAverageCoherence =
    breathHistory.length > 0
      ? breathHistory.reduce((sum, session) => sum + session.coherenceScore, 0) / breathHistory.length
      : null;
  const breathAverageRate =
    breathHistory.length > 0
      ? breathHistory.reduce((sum, session) => sum + session.averageBreathBpm, 0) / breathHistory.length
      : null;
  const latestHarmonicSession = harmonicHistory[0] ?? null;
  const previousHarmonicSession = harmonicHistory[1] ?? null;
  const harmonicIntensityDelta =
    latestHarmonicSession && previousHarmonicSession
      ? latestHarmonicSession.intensity - previousHarmonicSession.intensity
      : null;
  const harmonicAverageIntensity =
    harmonicHistory.length > 0
      ? harmonicHistory.reduce((sum, session) => sum + session.intensity, 0) / harmonicHistory.length
      : null;
  const harmonicPresetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    harmonicHistory.forEach((session) => {
      counts[session.presetId] = (counts[session.presetId] ?? 0) + 1;
    });
    return counts;
  }, [harmonicHistory]);
  const harmonicTopPreset = useMemo(() => {
    const entries = Object.entries(harmonicPresetCounts);
    if (entries.length === 0) {
      return null;
    }
    return entries.sort((left, right) => right[1] - left[1])[0][0];
  }, [harmonicPresetCounts]);
  const latestIntentionImprint = intentionHistory[0] ?? null;
  const previousIntentionImprint = intentionHistory[1] ?? null;
  const intentionConfidenceDelta =
    latestIntentionImprint && previousIntentionImprint
      ? latestIntentionImprint.mappingConfidence - previousIntentionImprint.mappingConfidence
      : null;
  const intentionAverageConfidence =
    intentionHistory.length > 0
      ? intentionHistory.reduce((sum, entry) => sum + entry.mappingConfidence, 0) / intentionHistory.length
      : null;
  const intentionAverageRitualIntensity =
    intentionHistory.length > 0
      ? intentionHistory.reduce((sum, entry) => sum + entry.ritualIntensity, 0) / intentionHistory.length
      : null;
  const intentionKeywordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    intentionHistory.forEach((entry) => {
      entry.extractedKeywords.forEach((keyword) => {
        counts[keyword] = (counts[keyword] ?? 0) + 1;
      });
    });
    return counts;
  }, [intentionHistory]);
  const intentionTopKeyword = useMemo(() => {
    const entries = Object.entries(intentionKeywordCounts);
    if (entries.length === 0) {
      return null;
    }
    return entries.sort((left, right) => right[1] - left[1])[0][0];
  }, [intentionKeywordCounts]);

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

      {isOwner ? (
        <Card className="glass-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Breath-Sync History</h2>
              <p className="text-sm text-ink/60">
                Private coherence sessions captured from manual or microphone pacing mode.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-ink/50">
              {breathHistory.length} sessions
            </span>
          </div>

          {breathHistoryStatus ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {breathHistoryStatus}
            </p>
          ) : null}

          {breathHistory.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/60">
              <p>No breath sessions yet. Enable Breath-Sync in Creator and save a session.</p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/create">Open Creator</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Latest coherence</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {latestBreathSession ? formatPercent(latestBreathSession.coherenceScore) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Coherence trend</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {breathCoherenceDelta !== null ? formatSignedPercent(breathCoherenceDelta) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Avg breath rate</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {breathAverageRate !== null ? `${breathAverageRate.toFixed(1)} bpm` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Avg coherence</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {breathAverageCoherence !== null ? formatPercent(breathAverageCoherence) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {breathHistory.map((entry, index) => (
                  <div key={entry.id} className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink/85">
                        Session #{breathHistory.length - index} · {formatDateTime(entry.createdAt)}
                      </p>
                      <span className="text-xs text-ink/60">
                        {entry.mode} · coherence {formatPercent(entry.coherenceScore)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">
                      Rate {entry.averageBreathBpm.toFixed(1)} bpm (target {entry.targetBpm.toFixed(1)} bpm) · peak{' '}
                      {formatPercent(entry.peakCoherenceScore)}
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      Time in coherence {formatPercent(entry.timeInCoherencePct)} · inhale ratio{' '}
                      {Math.round(entry.inhaleRatio * 100)}%
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      Sensitivity {Math.round(entry.sensitivity * 100)}% · {entry.sampleCount} samples
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="glass-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Solfeggio Harmonic Field History</h2>
              <p className="text-sm text-ink/60">
                Private records of your harmonic field sessions, presets, and intensity trends.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-ink/50">
              {harmonicHistory.length} sessions
            </span>
          </div>

          {harmonicHistoryStatus ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {harmonicHistoryStatus}
            </p>
          ) : null}

          {harmonicHistory.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/60">
              <p>No harmonic field sessions yet. Enable Solfeggio Harmonic Field in Creator and save a session.</p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/create">Open Creator</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Latest preset</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">{latestHarmonicSession?.presetId ?? 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Avg intensity</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {harmonicAverageIntensity !== null ? formatPercent(harmonicAverageIntensity) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Intensity trend</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {harmonicIntensityDelta !== null ? formatSignedPercent(harmonicIntensityDelta) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Most used preset</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">{harmonicTopPreset ?? 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {harmonicHistory.map((entry, index) => (
                  <div key={entry.id} className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink/85">
                        Session #{harmonicHistory.length - index} · {formatDateTime(entry.createdAt)}
                      </p>
                      <span className="text-xs text-ink/60">
                        Intensity {formatPercent(entry.intensity)} · Motion {formatPercent(entry.motionSpeed)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">
                      Preset {entry.presetId} · Layers {formatHz(entry.layerFrequencies)}
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      Interference:{' '}
                      {entry.interferenceFrequencies.length > 0
                        ? entry.interferenceFrequencies
                            .slice(0, 8)
                            .map((frequency) => `${frequency.toFixed(1)}Hz`)
                            .join(', ')
                        : 'Off'}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      {entry.includeInterference ? 'Interference on' : 'Interference off'} ·{' '}
                      {entry.spatialMotionEnabled ? 'Spatial motion on' : 'Spatial motion off'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="glass-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Quantum Intention Imprint History</h2>
              <p className="text-sm text-ink/60">
                Private records of your intention mappings and modulation profiles.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-ink/50">
              {intentionHistory.length} imprints
            </span>
          </div>

          {intentionHistoryStatus ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {intentionHistoryStatus}
            </p>
          ) : null}

          {intentionHistory.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/60">
              <p>No intention imprints yet. Enable Quantum Intention mode in Creator and save a session.</p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/create">Open Creator</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Latest seed</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {latestIntentionImprint?.certificateSeed ?? 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Avg mapping confidence</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {intentionAverageConfidence !== null ? formatPercent(intentionAverageConfidence) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Confidence trend</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {intentionConfidenceDelta !== null ? formatSignedPercent(intentionConfidenceDelta) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Avg ritual intensity</p>
                  <p className="mt-1 text-sm font-semibold text-ink/85">
                    {intentionAverageRitualIntensity !== null ? formatPercent(intentionAverageRitualIntensity) : 'N/A'}
                  </p>
                  <p className="text-xs text-ink/55">Top keyword: {intentionTopKeyword ?? 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {intentionHistory.map((entry, index) => (
                  <div key={entry.id} className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink/85">
                        Imprint #{intentionHistory.length - index} · {formatDateTime(entry.createdAt)}
                      </p>
                      <span className="text-xs text-ink/60">
                        Confidence {formatPercent(entry.mappingConfidence)} · Intensity {formatPercent(entry.ritualIntensity)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">
                      {entry.intentionText.length > 140
                        ? `${entry.intentionText.slice(0, 137)}...`
                        : entry.intentionText || 'No intention text recorded.'}
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      Keywords: {formatKeywords(entry.extractedKeywords)} · Field: {formatHz(entry.mappedFrequencies)}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      Mod {entry.modulationRateHz.toFixed(2)}Hz / {entry.modulationDepthHz.toFixed(2)} depth · Seed{' '}
                      {entry.certificateSeed ?? 'n/a'}
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
