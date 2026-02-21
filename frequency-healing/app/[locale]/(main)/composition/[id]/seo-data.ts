import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_DESCRIPTION } from '@/lib/utils/seo';
import { formatFrequencyList } from '@/lib/utils/helpers';

export type CompositionSeoRecord = {
  id: string;
  title: string;
  description: string | null;
  frequencies: number[];
  thumbnail_url: string | null;
  audio_url: string | null;
  duration: number | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export const getCompositionSeoRecord = cache(async (id: string): Promise<CompositionSeoRecord | null> => {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('compositions')
    .select('id, title, description, frequencies, thumbnail_url, audio_url, duration, tags, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  return data;
});

export function compositionDescription(
  record: CompositionSeoRecord | null,
  options?: {
    defaultDescription?: string;
    fallbackDescription?: string;
    withFrequenciesDescription?: (frequencySummary: string) => string;
  }
) {
  if (!record) {
    return options?.defaultDescription || DEFAULT_DESCRIPTION;
  }

  if (record.description?.trim()) {
    return record.description.trim();
  }

  const frequencySummary =
    record.frequencies && record.frequencies.length > 0 ? formatFrequencyList(record.frequencies) : '';

  if (!frequencySummary) {
    return options?.fallbackDescription || 'Listen to a shared healing frequency session with immersive visuals.';
  }

  if (options?.withFrequenciesDescription) {
    return options.withFrequenciesDescription(frequencySummary);
  }

  return `Listen to a healing frequency session featuring ${frequencySummary}.`;
}
