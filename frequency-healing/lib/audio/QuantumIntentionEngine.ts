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
export type IntentionLocale = 'en' | 'ja';

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

interface ThemeDefinition {
  id: string;
  tone: ThemeTone;
  labels: Record<IntentionLocale, string>;
  keywords: Record<IntentionLocale, string[]>;
  phrases: Record<IntentionLocale, string[]>;
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

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'healing',
    tone: 'supportive',
    labels: { en: 'healing', ja: 'ヒーリング' },
    keywords: {
      en: ['heal', 'healing', 'restore', 'recovery', 'repair', 'regenerate', 'wellness', 'healthy'],
      ja: ['癒し', '回復', '修復', '再生', '健康', '整える']
    },
    phrases: {
      en: ['self healing', 'inner healing', 'physical healing'],
      ja: ['自己治癒', '内なる癒し', '身体の癒し']
    },
    frequencies: [528, 432, 639],
    modulationRateHz: 0.18,
    modulationDepthHz: 8.2
  },
  {
    id: 'love',
    tone: 'supportive',
    labels: { en: 'love', ja: '愛' },
    keywords: {
      en: ['love', 'loving', 'heart', 'affection', 'care', 'connection', 'belonging'],
      ja: ['愛', '愛情', '心', 'ハート', 'つながり', '思いやり']
    },
    phrases: {
      en: ['unconditional love', 'self love', 'heart opening'],
      ja: ['無条件の愛', '自己愛', '心を開く']
    },
    frequencies: [639, 528, 741],
    modulationRateHz: 0.21,
    modulationDepthHz: 7.3
  },
  {
    id: 'compassion',
    tone: 'supportive',
    labels: { en: 'compassion', ja: '慈しみ' },
    keywords: {
      en: ['compassion', 'kindness', 'gentle', 'empathy', 'warmth', 'grace'],
      ja: ['慈しみ', '優しさ', '共感', 'ぬくもり', '思いやり', '寛容']
    },
    phrases: {
      en: ['be kind', 'soft heart', 'gentle strength'],
      ja: ['優しくある', '柔らかな心', '穏やかな強さ']
    },
    frequencies: [639, 432, 528],
    modulationRateHz: 0.2,
    modulationDepthHz: 6.9
  },
  {
    id: 'grounding',
    tone: 'grounding',
    labels: { en: 'grounding', ja: 'グラウンディング' },
    keywords: {
      en: ['ground', 'grounded', 'grounding', 'stable', 'safety', 'secure', 'root', 'earth', 'balance'],
      ja: ['グラウンディング', '安定', '安心', '土台', '根', '地', 'バランス']
    },
    phrases: {
      en: ['mother earth', 'earth energy', 'feel safe'],
      ja: ['大地とつながる', '地のエネルギー', '安心を感じる']
    },
    frequencies: [396, 432, 417],
    modulationRateHz: 0.14,
    modulationDepthHz: 9.1
  },
  {
    id: 'calm',
    tone: 'grounding',
    labels: { en: 'calm', ja: '静けさ' },
    keywords: {
      en: ['calm', 'peace', 'still', 'quiet', 'settle', 'soothe', 'relax', 'ease'],
      ja: ['落ち着き', '平和', '静か', '鎮まる', '和らぐ', 'リラックス']
    },
    phrases: {
      en: ['inner peace', 'nervous system calm', 'rest and reset'],
      ja: ['内なる平和', '神経系を落ち着かせる', '休息とリセット']
    },
    frequencies: [432, 528, 639],
    modulationRateHz: 0.13,
    modulationDepthHz: 8.5
  },
  {
    id: 'grief',
    tone: 'transformative',
    labels: { en: 'grief support', ja: '悲嘆サポート' },
    keywords: {
      en: ['sad', 'sadness', 'grief', 'grieving', 'sorrow', 'heartbreak', 'lonely', 'hurt'],
      ja: ['悲しみ', '悲嘆', '喪失', '心の痛み', '孤独', '傷つき']
    },
    phrases: {
      en: ['release sadness', 'process grief', 'healing sorrow'],
      ja: ['悲しみを解放', '悲嘆を癒す', '喪失を受け止める']
    },
    frequencies: [396, 417, 528],
    modulationRateHz: 0.2,
    modulationDepthHz: 10.1
  },
  {
    id: 'anger',
    tone: 'transformative',
    labels: { en: 'anger release', ja: '怒りの解放' },
    keywords: {
      en: ['anger', 'angry', 'rage', 'resentment', 'irritation', 'furious', 'mad', 'frustration'],
      ja: ['怒り', '憤り', '苛立ち', '不満', '激怒', 'フラストレーション']
    },
    phrases: {
      en: ['release anger', 'transmute anger', 'let go of rage'],
      ja: ['怒りを解放', '怒りを変容', '憤りを手放す']
    },
    frequencies: [741, 396, 417],
    modulationRateHz: 0.27,
    modulationDepthHz: 10.8
  },
  {
    id: 'fear',
    tone: 'transformative',
    labels: { en: 'fear to safety', ja: '恐れから安心へ' },
    keywords: {
      en: ['fear', 'anxiety', 'worry', 'panic', 'unsafe', 'stress', 'tense', 'afraid'],
      ja: ['恐れ', '不安', '心配', 'パニック', 'ストレス', '緊張', '怖い']
    },
    phrases: {
      en: ['feel safe now', 'release fear', 'calm anxiety'],
      ja: ['今ここで安心', '恐れを解放', '不安を鎮める']
    },
    frequencies: [396, 432, 528],
    modulationRateHz: 0.17,
    modulationDepthHz: 9.5
  },
  {
    id: 'attachment',
    tone: 'transformative',
    labels: { en: 'attachment release', ja: '執着の解放' },
    keywords: {
      en: ['greed', 'greedy', 'craving', 'attachment', 'cling', 'clinging', 'possessive', 'envy'],
      ja: ['執着', '渇望', '貪り', '手放せない', '嫉妬', '固執']
    },
    phrases: {
      en: ['release attachment', 'let go of greed', 'free from craving'],
      ja: ['執着を解放', '欲を手放す', '渇望から自由になる']
    },
    frequencies: [417, 396, 741],
    modulationRateHz: 0.24,
    modulationDepthHz: 10.3
  },
  {
    id: 'confusion',
    tone: 'transformative',
    labels: { en: 'clarity from confusion', ja: '混乱から明晰へ' },
    keywords: {
      en: ['delusion', 'deluded', 'confusion', 'confused', 'uncertain', 'foggy', 'illusion', 'doubt'],
      ja: ['混乱', '迷い', '不確か', 'もやもや', '錯覚', '疑い', '曖昧']
    },
    phrases: {
      en: ['clear confusion', 'clarify mind', 'cut through illusion'],
      ja: ['混乱を晴らす', '心を明晰にする', '幻想を見抜く']
    },
    frequencies: [852, 741, 528],
    modulationRateHz: 0.29,
    modulationDepthHz: 8.9
  },
  {
    id: 'clarity',
    tone: 'supportive',
    labels: { en: 'clarity', ja: '明晰' },
    keywords: {
      en: ['clarity', 'focus', 'clear', 'purpose', 'discipline', 'attention', 'study'],
      ja: ['明晰', '集中', '明確', '目的', '規律', '注意', '学習']
    },
    phrases: {
      en: ['sharp focus', 'clear direction', 'mental clarity'],
      ja: ['鋭い集中', '明確な方向', '精神の明晰さ']
    },
    frequencies: [741, 852, 528],
    modulationRateHz: 0.33,
    modulationDepthHz: 6.4
  },
  {
    id: 'intuition',
    tone: 'supportive',
    labels: { en: 'intuition', ja: '直感' },
    keywords: {
      en: ['intuition', 'insight', 'wisdom', 'awareness', 'vision', 'guidance', 'spirit'],
      ja: ['直感', '洞察', '智慧', '気づき', '導き', 'スピリット']
    },
    phrases: {
      en: ['inner guidance', 'trust intuition', 'higher perspective'],
      ja: ['内なる導き', '直感を信頼', '高い視点']
    },
    frequencies: [852, 963, 741],
    modulationRateHz: 0.23,
    modulationDepthHz: 7.7
  },
  {
    id: 'forgiveness',
    tone: 'supportive',
    labels: { en: 'forgiveness', ja: '赦し' },
    keywords: {
      en: ['forgive', 'forgiveness', 'release', 'accept', 'mercy', 'reconcile'],
      ja: ['赦し', '受容', '和解', '手放し', '慈悲']
    },
    phrases: {
      en: ['forgive myself', 'forgive others', 'release resentment'],
      ja: ['自分を赦す', '他者を赦す', 'わだかまりを手放す']
    },
    frequencies: [417, 639, 528],
    modulationRateHz: 0.22,
    modulationDepthHz: 8
  },
  {
    id: 'abundance',
    tone: 'supportive',
    labels: { en: 'abundance', ja: '豊かさ' },
    keywords: {
      en: ['abundance', 'prosperity', 'wealth', 'success', 'growth', 'opportunity', 'flourish'],
      ja: ['豊かさ', '繁栄', '成功', '成長', '機会', '実り']
    },
    phrases: {
      en: ['abundant life', 'receive abundance', 'expand prosperity'],
      ja: ['豊かな人生', '豊かさを受け取る', '繁栄を広げる']
    },
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

function resolveLocale(locale?: IntentionLocale): IntentionLocale {
  return locale === 'ja' ? 'ja' : 'en';
}

function getThemeMappings(locale: IntentionLocale): ThemeMapping[] {
  return THEME_DEFINITIONS.map((entry) => ({
    id: entry.id,
    label: entry.labels[locale],
    tone: entry.tone,
    keywords: entry.keywords[locale],
    phrases: entry.phrases[locale],
    frequencies: entry.frequencies,
    modulationRateHz: entry.modulationRateHz,
    modulationDepthHz: entry.modulationDepthHz
  }));
}

function normalizeText(input: string, locale: IntentionLocale) {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return '';
  }

  if (locale === 'ja') {
    return trimmed
      .replace(/[。、「」『』（）()［］【】？！!?.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return trimmed
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function tokenizeEnglish(input: string) {
  const normalized = normalizeText(input, 'en');
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

function tokenizeJapanese(input: string, mappings: ThemeMapping[]) {
  const normalized = normalizeText(input, 'ja');
  if (!normalized) {
    return { normalized, tokens: [] as TokenizedWord[] };
  }

  const tokenSet = new Set<string>();

  normalized
    .split(' ')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      tokenSet.add(value);
    });

  mappings.forEach((mapping) => {
    mapping.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword, 'ja');
      if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
        tokenSet.add(normalizedKeyword);
      }
    });
  });

  const tokens = Array.from(tokenSet).map((raw) => ({ raw, stem: raw }));
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

function hasPhrase(input: string, phrase: string, locale: IntentionLocale) {
  const trimmed = normalizeText(phrase, locale);
  if (!trimmed) {
    return false;
  }

  if (locale === 'ja') {
    return input.includes(trimmed);
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

function collectThemeHits(
  tokens: TokenizedWord[],
  normalizedText: string,
  mappings: ThemeMapping[],
  locale: IntentionLocale
): ThemeHit[] {
  return mappings
    .map((mapping) => {
      const tokenHitSet = new Set<string>();

      if (locale === 'ja') {
        mapping.keywords.forEach((keyword) => {
          const normalizedKeyword = normalizeText(keyword, 'ja');
          if (normalizedKeyword && normalizedText.includes(normalizedKeyword)) {
            tokenHitSet.add(normalizedKeyword);
          }
        });
      } else {
        const keywordStems = new Set(mapping.keywords.map((keyword) => stemToken(keyword.toLowerCase())));

        tokens.forEach((token) => {
          if (keywordStems.has(token.stem) || keywordStems.has(token.raw)) {
            tokenHitSet.add(token.raw);
          }
        });
      }

      const phraseHits = mapping.phrases
        .map((phrase) => normalizeText(phrase, locale))
        .filter((phrase) => hasPhrase(normalizedText, phrase, locale));

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

  return selectedThemes.reduce((sum, entry) => sum + entry.mapping[key] * entry.score, 0) / totalWeight;
}

function buildReflectionSummary(locale: IntentionLocale, selectedThemes: ThemeHit[]) {
  if (selectedThemes.length === 0) {
    return locale === 'ja'
      ? '強いテーマ一致がありません。中立的な調和ブレンドを使用します。'
      : 'No strong theme match. Using a neutral harmonizing blend.';
  }

  const themeLabels = selectedThemes.map((entry) => entry.mapping.label).join(', ');

  if (selectedThemes.some((entry) => entry.mapping.tone === 'transformative')) {
    return locale === 'ja'
      ? `マッピングテーマ: ${themeLabels}。解放志向のサポートトーンを含みます。`
      : `Mapped themes: ${themeLabels}. Includes release-oriented support tones.`;
  }

  if (selectedThemes.some((entry) => entry.mapping.tone === 'grounding')) {
    return locale === 'ja'
      ? `マッピングテーマ: ${themeLabels}。グラウンディングと安定化を重視します。`
      : `Mapped themes: ${themeLabels}. Emphasizes grounding and stabilization.`;
  }

  return locale === 'ja'
    ? `マッピングテーマ: ${themeLabels}。サポーティブな共鳴を重視します。`
    : `Mapped themes: ${themeLabels}. Emphasizes supportive resonance.`;
}

export function analyzeQuantumIntention(text: string, options?: { locale?: IntentionLocale }): IntentionImprintResult {
  const locale = resolveLocale(options?.locale);
  const mappings = getThemeMappings(locale);
  const { normalized, tokens } =
    locale === 'ja' ? tokenizeJapanese(text, mappings) : tokenizeEnglish(text);
  const hits = collectThemeHits(tokens, normalized, mappings, locale);
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
  const emotionalIntensity = clamp(
    0,
    exclamationCount * 0.08 + uppercaseWordCount * 0.1 + transformativeThemeCount * 0.08,
    0.45
  );

  const ritualIntensity = Number(clamp(0.2, 0.32 + confidence * 0.5 + emotionalIntensity, 1).toFixed(3));

  const modulationRateHz = Number(clamp(0.08, weightedRate * (1 + emotionalIntensity * 0.18), 3.2).toFixed(3));
  const modulationDepthHz = Number(clamp(1.5, weightedDepth * (1 + emotionalIntensity * 0.35), 30).toFixed(2));

  return {
    normalizedText: normalized,
    keywords,
    mappedFrequencies,
    modulationRateHz,
    modulationDepthHz,
    ritualIntensity,
    confidence,
    certificateSeed: stableSeedFromText(normalized),
    reflectionSummary: buildReflectionSummary(locale, selectedThemes)
  };
}

export function buildIntentionShareText(options: {
  intentionText: string;
  keywords: string[];
  mappedFrequencies: number[];
  certificateSeed: string;
  locale?: IntentionLocale;
}) {
  const locale = resolveLocale(options.locale);
  const title = options.intentionText.trim() || (locale === 'ja' ? '私の意図' : 'My intention');
  const keywords = dedupeStrings(options.keywords).slice(0, 4);
  const mappedFrequencies = Array.from(
    new Set(options.mappedFrequencies.map((frequency) => normalizeFrequency(frequency)))
  ).slice(0, 4);
  const parts = [title];

  if (keywords.length > 0) {
    parts.push(`${locale === 'ja' ? 'キーワード' : 'Keywords'}: ${keywords.join(', ')}.`);
  }

  if (mappedFrequencies.length > 0) {
    parts.push(
      `${locale === 'ja' ? 'フィールド' : 'Field'}: ${mappedFrequencies
        .map((frequency) => `${Math.round(frequency)}Hz`)
        .join(' • ')}.`
    );
  }

  parts.push(`${locale === 'ja' ? 'シード' : 'Seed'} ${options.certificateSeed || 'INT-UNKNOWN'}`);

  return parts.join(' | ');
}
