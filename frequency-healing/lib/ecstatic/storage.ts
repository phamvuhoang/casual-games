import type { EcstaticSessionSetupDraft, EcstaticSessionSnapshot } from '@/lib/ecstatic/types';

const DRAFT_KEY = 'frequency-healing:ecstatic:draft:v1';
const HISTORY_KEY = 'frequency-healing:ecstatic:history:v1';
const MAX_HISTORY = 40;

function isClient() {
  return typeof window !== 'undefined';
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return null;
  }
}

export function loadEcstaticDraft() {
  if (!isClient()) {
    return null;
  }
  return parseJson<EcstaticSessionSetupDraft>(window.localStorage.getItem(DRAFT_KEY));
}

export function saveEcstaticDraft(draft: EcstaticSessionSetupDraft) {
  if (!isClient()) {
    return;
  }
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearEcstaticDraft() {
  if (!isClient()) {
    return;
  }
  window.localStorage.removeItem(DRAFT_KEY);
}

export function loadEcstaticHistory() {
  if (!isClient()) {
    return [] as EcstaticSessionSnapshot[];
  }
  const parsed = parseJson<EcstaticSessionSnapshot[]>(window.localStorage.getItem(HISTORY_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveEcstaticHistory(history: EcstaticSessionSnapshot[]) {
  if (!isClient()) {
    return;
  }
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export function appendEcstaticHistory(snapshot: EcstaticSessionSnapshot) {
  const history = loadEcstaticHistory();
  const deduped = history.filter((entry) => entry.id !== snapshot.id);
  const next = [snapshot, ...deduped].slice(0, MAX_HISTORY);
  saveEcstaticHistory(next);
  return next;
}

export function removeEcstaticSession(sessionId: string) {
  const history = loadEcstaticHistory();
  const next = history.filter((entry) => entry.id !== sessionId);
  saveEcstaticHistory(next);
  return next;
}

export function clearEcstaticHistory() {
  if (!isClient()) {
    return;
  }
  window.localStorage.removeItem(HISTORY_KEY);
}

export function serializeEcstaticSession(snapshot: EcstaticSessionSnapshot) {
  return JSON.stringify(snapshot, null, 2);
}

export function parseEcstaticSession(text: string) {
  try {
    const parsed = JSON.parse(text) as EcstaticSessionSnapshot;
    if (!parsed || parsed.version !== 1 || typeof parsed.id !== 'string') {
      return null;
    }
    if (!Array.isArray(parsed.phaseEvents) || !Array.isArray(parsed.samples) || !Array.isArray(parsed.sceneChanges)) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}
