import { clamp, normalizeFrequency } from '@/lib/audio/audioConfig';

export interface IntentionImprintResult {
  normalizedText: string;
  keywords: string[];
  mappedFrequencies: number[];
  modulationRateHz: number;
  modulationDepthHz: number;
  ritualIntensity: number;
  confidence: number;
  certificateSeed: string;
  reflectionSummary: string;
}

type ThemeTone = 'supportive' | 'grounding' | 'transformative';

interface ThemeMapping {
  id: string;
  label: string;
  tone: ThemeTone;
  keywords: string[];
  phrases: string[];
  frequencies: number[];
  modulationRateHz: number;
  modulationDepthHz: number;
}

interface TokenizedWord {
  raw: string;
  stem: string;
}

interface ThemeHit {
  mapping: ThemeMapping;
  score: number;
  tokenHits: string[];
  phraseHits: string[];
}

const THEME_MAPPINGS: ThemeMapping[] = [
  {
    id: 'healing',
    label: 'healing',
    tone: 'supportive',
    keywords: ['heal', 'healing', 'restore', 'recovery', 'repair', 'regenerate', 'wellness', 'healthy'],
    phrases: ['self healing', 'inner healing', 'physical healing'],
    frequencies: [528, 432, 639],
    modulationRateHz: 0.18,
    modulationDepthHz: 8.2
  },
  {
    id: 'love',
    label: 'love',
    tone: 'supportive',
    keywords: ['love', 'loving', 'heart', 'affection', 'care', 'connection', 'belonging'],
    phrases: ['unconditional love', 'self love', 'heart opening'],
    frequencies: [639, 528, 741],
    modulationRateHz: 0.21,
    modulationDepthHz: 7.3
  },
  {
    id: 'compassion',
    label: 'compassion',
    tone: 'supportive',
    keywords: ['compassion', 'kindness', 'gentle', 'empathy', 'warmth', 'grace'],
    phrases: ['be kind', 'soft heart', 'gentle strength'],
    frequencies: [639, 432, 528],
    modulationRateHz: 0.2,
    modulationDepthHz: 6.9
  },
  {
    id: 'grounding',
    label: 'grounding',
    tone: 'grounding',
    keywords: ['ground', 'grounded', 'grounding', 'stable', 'safety', 'secure', 'root', 'earth', 'balance'],
    phrases: ['mother earth', 'earth energy', 'feel safe'],
    frequencies: [396, 432, 417],
    modulationRateHz: 0.14,
    modulationDepthHz: 9.1
  },
  {
    id: 'calm',
    label: 'calm',
    tone: 'grounding',
    keywords: ['calm', 'peace', 'still', 'quiet', 'settle', 'soothe', 'relax', 'ease'],
    phrases: ['inner peace', 'nervous system calm', 'rest and reset'],
    frequencies: [432, 528, 639],
    modulationRateHz: 0.13,
    modulationDepthHz: 8.5
  },
  {
    id: 'grief',
    label: 'grief support',
    tone: 'transformative',
    keywords: ['sad', 'sadness', 'grief', 'grieving', 'sorrow', 'heartbreak', 'lonely', 'hurt'],
    phrases: ['release sadness', 'process grief', 'healing sorrow'],
    frequencies: [396, 417, 528],
    modulationRateHz: 0.2,
    modulationDepthHz: 10.1
  },
  {
    id: 'anger',
    label: 'anger release',
    tone: 'transformative',
    keywords: ['anger', 'angry', 'rage', 'resentment', 'irritation', 'furious', 'mad', 'frustration'],
    phrases: ['release anger', 'transmute anger', 'let go of rage'],
    frequencies: [741, 396, 417],
    modulationRateHz: 0.27,
    modulationDepthHz: 10.8
  },
  {
    id: 'fear',
    label: 'fear to safety',
    tone: 'transformative',
    keywords: ['fear', 'anxiety', 'worry', 'panic', 'unsafe', 'stress', 'tense', 'afraid'],
    phrases: ['feel safe now', 'release fear', 'calm anxiety'],
    frequencies: [396, 432, 528],
    modulationRateHz: 0.17,
    modulationDepthHz: 9.5
  },
  {
    id: 'attachment',
    label: 'attachment release',
    tone: 'transformative',
    keywords: ['greed', 'greedy', 'craving', 'attachment', 'cling', 'clinging', 'possessive', 'envy'],
    phrases: ['release attachment', 'let go of greed', 'free from craving'],
    frequencies: [417, 396, 741],
    modulationRateHz: 0.24,
    modulationDepthHz: 10.3
  },
  {
    id: 'confusion',
    label: 'clarity from confusion',
    tone: 'transformative',
    keywords: ['delusion', 'deluded', 'confusion', 'confused', 'uncertain', 'foggy', 'illusion', 'doubt'],
    phrases: ['clear confusion', 'clarify mind', 'cut through illusion'],
    frequencies: [852, 741, 528],
    modulationRateHz: 0.29,
    modulationDepthHz: 8.9
  },
  {
    id: 'clarity',
    label: 'clarity',
    tone: 'supportive',
    keywords: ['clarity', 'focus', 'clear', 'purpose', 'discipline', 'attention', 'study'],
    phrases: ['sharp focus', 'clear direction', 'mental clarity'],
    frequencies: [741, 852, 528],
    modulationRateHz: 0.33,
    modulationDepthHz: 6.4
  },
  {
    id: 'intuition',
    label: 'intuition',
    tone: 'supportive',
    keywords: ['intuition', 'insight', 'wisdom', 'awareness', 'vision', 'guidance', 'spirit'],
    phrases: ['inner guidance', 'trust intuition', 'higher perspective'],
    frequencies: [852, 963, 741],
    modulationRateHz: 0.23,
    modulationDepthHz: 7.7
  },
  {
    id: 'forgiveness',
    label: 'forgiveness',
    tone: 'supportive',
    keywords: ['forgive', 'forgiveness', 'release', 'accept', 'mercy', 'reconcile'],
    phrases: ['forgive myself', 'forgive others', 'release resentment'],
    frequencies: [417, 639, 528],
    modulationRateHz: 0.22,
    modulationDepthHz: 8
  },
  {
    id: 'abundance',
    label: 'abundance',
    tone: 'supportive',
    keywords: ['abundance', 'prosperity', 'wealth', 'success', 'growth', 'opportunity', 'flourish'],
    phrases: ['abundant life', 'receive abundance', 'expand prosperity'],
    frequencies: [417, 528, 963],
    modulationRateHz: 0.27,
    modulationDepthHz: 7.1
  }
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'at',
  'from',
  'by',
  'is',
  'are',
  'be',
  'been',
  'being',
  'am',
  'was',
  'were',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'i',
  'me',
  'my',
  'mine',
  'we',
  'our',
  'ours',
  'you',
  'your',
  'yours',
  'he',
  'she',
  'they',
  'them',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'very',
  'much',
  'really',
  'just',
  'too',
  'also',
  'still',
  'now',
  'then',
  'than',
  'into',
  'onto',
  'about',
  'over',
  'under'
]);

function normalizeText(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function stemToken(token: string) {
  if (token.length <= 3) {
    return token;
  }

  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith('ing') && token.length > 5) {
    return token.slice(0, -3);
  }

  if (token.endsWith('ed') && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith('ly') && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith('s') && token.length > 4 && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenize(input: string) {
  const normalized = normalizeText(input);
  if (!normalized) {
    return { normalized, tokens: [] as TokenizedWord[] };
  }

  const tokens = normalized
    .split(' ')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length >= 2)
    .map((raw) => {
      const stem = stemToken(raw);
      return { raw, stem };
    })
    .filter((token) => !STOP_WORDS.has(token.raw) && !STOP_WORDS.has(token.stem));

  return { normalized, tokens };
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });

  return output;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(input: string, phrase: string) {
  const trimmed = phrase.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }

  const escaped = escapeRegExp(trimmed).replace(/\s+/g, '\\s+');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(input);
}

function stableSeedFromText(text: string) {
  const source = text || 'intention';
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  const positive = Math.abs(hash);
  const base = positive.toString(36).toUpperCase();
  return `INT-${base.padStart(8, '0').slice(0, 8)}`;
}

function collectThemeHits(tokens: TokenizedWord[], normalizedText: string): ThemeHit[] {
  return THEME_MAPPINGS.map((mapping) => {
    const keywordStems = new Set(mapping.keywords.map((keyword) => stemToken(keyword.toLowerCase())));
    const tokenHitSet = new Set<string>();

    tokens.forEach((token) => {
      if (keywordStems.has(token.stem) || keywordStems.has(token.raw)) {
        tokenHitSet.add(token.raw);
      }
    });

    const phraseHits = mapping.phrases
      .map((phrase) => phrase.toLowerCase())
      .filter((phrase) => hasPhrase(normalizedText, phrase));

    if (tokenHitSet.size === 0 && phraseHits.length === 0) {
      return null;
    }

    const toneBias = mapping.tone === 'transformative' ? 0.15 : mapping.tone === 'grounding' ? 0.12 : 0.1;
    const score = tokenHitSet.size * 1.05 + phraseHits.length * 1.8 + toneBias;

    return {
      mapping,
      score,
      tokenHits: Array.from(tokenHitSet),
      phraseHits
    };
  })
    .filter((entry): entry is ThemeHit => Boolean(entry))
    .sort((left, right) => right.score - left.score);
}

function selectThemes(hits: ThemeHit[]) {
  if (hits.length === 0) {
    return [] as ThemeHit[];
  }

  const topScore = hits[0].score;
  const selected = hits.filter((entry, index) => index === 0 || entry.score >= topScore * 0.5).slice(0, 3);
  return selected.length > 0 ? selected : [hits[0]];
}

function buildFrequencyBlend(selectedThemes: ThemeHit[]) {
  if (selectedThemes.length === 0) {
    return [432, 528, 639];
  }

  const weightedFrequencies = new Map<number, number>();

  selectedThemes.forEach((themeHit, themeIndex) => {
    const themeWeight = themeHit.score * (1 - themeIndex * 0.15);

    themeHit.mapping.frequencies.forEach((frequency, frequencyIndex) => {
      const key = normalizeFrequency(frequency);
      const layerWeight = themeWeight * (1 - frequencyIndex * 0.12);
      weightedFrequencies.set(key, (weightedFrequencies.get(key) ?? 0) + layerWeight);
    });
  });

  return Array.from(weightedFrequencies.entries())
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0] - right[0];
      }
      return right[1] - left[1];
    })
    .map(([frequency]) => frequency)
    .slice(0, 6);
}

function weightedAverage(selectedThemes: ThemeHit[], key: 'modulationRateHz' | 'modulationDepthHz', fallback: number) {
  if (selectedThemes.length === 0) {
    return fallback;
  }

  const totalWeight = selectedThemes.reduce((sum, entry) => sum + entry.score, 0);
  if (totalWeight <= 0) {
    return fallback;
  }

  return (
    selectedThemes.reduce((sum, entry) => sum + entry.mapping[key] * entry.score, 0) /
    totalWeight
  );
}

export function analyzeQuantumIntention(text: string): IntentionImprintResult {
  const { normalized, tokens } = tokenize(text);
  const hits = collectThemeHits(tokens, normalized);
  const selectedThemes = selectThemes(hits);

  const mappedFrequencies = buildFrequencyBlend(selectedThemes);

  const tokenHits = dedupeStrings(selectedThemes.flatMap((entry) => entry.tokenHits));
  const phraseHits = dedupeStrings(selectedThemes.flatMap((entry) => entry.phraseHits));
  const fallbackKeywords = dedupeStrings(tokens.map((token) => token.raw));

  const keywords = dedupeStrings([...phraseHits, ...tokenHits, ...fallbackKeywords]).slice(0, 8);

  const weightedRate = weightedAverage(selectedThemes, 'modulationRateHz', 0.22);
  const weightedDepth = weightedAverage(selectedThemes, 'modulationDepthHz', 7.4);

  const informativeTokenCount = tokens.length;
  const matchUnits = tokenHits.length + phraseHits.length * 1.6;
  const coverage = informativeTokenCount > 0 ? clamp(0, matchUnits / (informativeTokenCount + 1.5), 1) : 0;

  const totalThemeScore = selectedThemes.reduce((sum, entry) => sum + entry.score, 0);
  const primaryThemeShare =
    totalThemeScore > 0 && selectedThemes.length > 0 ? selectedThemes[0].score / totalThemeScore : 0;
  const coherence = clamp(0.2, primaryThemeShare + (selectedThemes.length === 1 ? 0.2 : 0), 1);

  const rawConfidence =
    selectedThemes.length === 0
      ? informativeTokenCount > 0
        ? 0.24
        : 0.18
      : 0.2 + coverage * 0.45 + coherence * 0.27 + Math.min(0.08, selectedThemes.length * 0.03);
  const confidence = Number(clamp(0.18, rawConfidence, 0.95).toFixed(3));

  const exclamationCount = (text.match(/!/g) ?? []).length;
  const uppercaseWordCount = text
    .split(/\s+/)
    .filter((word) => word.length >= 3 && word === word.toUpperCase() && /[A-Z]/.test(word)).length;
  const transformativeThemeCount = selectedThemes.filter((entry) => entry.mapping.tone === 'transformative').length;
  const emotionalIntensity = clamp(0, exclamationCount * 0.08 + uppercaseWordCount * 0.1 + transformativeThemeCount * 0.08, 0.45);

  const ritualIntensity = Number(clamp(0.2, 0.32 + confidence * 0.5 + emotionalIntensity, 1).toFixed(3));

  const modulationRateHz = Number(clamp(0.08, weightedRate * (1 + emotionalIntensity * 0.18), 3.2).toFixed(3));
  const modulationDepthHz = Number(clamp(1.5, weightedDepth * (1 + emotionalIntensity * 0.35), 30).toFixed(2));

  const themeLabels = selectedThemes.map((entry) => entry.mapping.label);
  const reflectionSummary =
    selectedThemes.length === 0
      ? 'No strong theme match. Using a neutral harmonizing blend.'
      : selectedThemes.some((entry) => entry.mapping.tone === 'transformative')
        ? `Mapped themes: ${themeLabels.join(', ')}. Includes release-oriented support tones.`
        : selectedThemes.some((entry) => entry.mapping.tone === 'grounding')
          ? `Mapped themes: ${themeLabels.join(', ')}. Emphasizes grounding and stabilization.`
          : `Mapped themes: ${themeLabels.join(', ')}. Emphasizes supportive resonance.`;

  return {
    normalizedText: normalized,
    keywords,
    mappedFrequencies,
    modulationRateHz,
    modulationDepthHz,
    ritualIntensity,
    confidence,
    certificateSeed: stableSeedFromText(normalized),
    reflectionSummary
  };
}

export function buildIntentionShareText(options: {
  intentionText: string;
  keywords: string[];
  mappedFrequencies: number[];
  certificateSeed: string;
}) {
  const title = options.intentionText.trim() || 'My intention';
  const keywords = dedupeStrings(options.keywords).slice(0, 4);
  const mappedFrequencies = Array.from(new Set(options.mappedFrequencies.map((frequency) => normalizeFrequency(frequency)))).slice(0, 4);
  const parts = [title];

  if (keywords.length > 0) {
    parts.push(`Keywords: ${keywords.join(', ')}.`);
  }

  if (mappedFrequencies.length > 0) {
    parts.push(`Field: ${mappedFrequencies.map((frequency) => `${Math.round(frequency)}Hz`).join(' • ')}.`);
  }

  parts.push(`Seed ${options.certificateSeed || 'INT-UNKNOWN'}`);

  return parts.join(' | ');
}
