'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import {
  appendEcstaticHistory,
  clearEcstaticHistory,
  loadEcstaticHistory,
  parseEcstaticSession,
  removeEcstaticSession,
  serializeEcstaticSession
} from '@/lib/ecstatic/storage';
import type { ChangeEvent } from 'react';
import type { EcstaticSessionSnapshot } from '@/lib/ecstatic/types';
import { formatDuration } from '@/lib/utils/helpers';

function downloadJsonFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EcstaticReplayPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<EcstaticSessionSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextHistory = loadEcstaticHistory();
    setHistory(nextHistory);
    setSelectedId(nextHistory[0]?.id ?? null);
  }, []);

  const selected = useMemo(
    () => history.find((entry) => entry.id === selectedId) ?? history[0] ?? null,
    [history, selectedId]
  );

  const handleExport = () => {
    if (!selected) {
      return;
    }
    const fileName = `ecstatic-session-${selected.id}.json`;
    downloadJsonFile(fileName, serializeEcstaticSession(selected));
    setStatusMessage('Session exported as JSON.');
  };

  const handleDelete = () => {
    if (!selected) {
      return;
    }
    const next = removeEcstaticSession(selected.id);
    setHistory(next);
    setSelectedId(next[0]?.id ?? null);
    setStatusMessage('Session removed from local history.');
  };

  const handleClearAll = () => {
    clearEcstaticHistory();
    setHistory([]);
    setSelectedId(null);
    setStatusMessage('All local ecstatic session history cleared.');
  };

  const handleImportClick = () => {
    inputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const parsed = parseEcstaticSession(text);
    if (!parsed) {
      setStatusMessage('Invalid session file. Expected a Phase 2.5B session JSON.');
      return;
    }
    const next = appendEcstaticHistory(parsed);
    setHistory(next);
    setSelectedId(parsed.id);
    setStatusMessage('Session imported successfully.');
    event.target.value = '';
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <Card className="p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Ecstatic Replay</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Local Session Timeline</h1>
        <p className="mt-3 text-sm text-ink/70">
          Review phase events, export/import JSON snapshots, and continue iterating without any database migrations.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/58">Session History</h2>
            <span className="text-xs text-ink/58">{history.length} local sessions</span>
          </div>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-white/75 p-4 text-sm text-ink/68">
              No local sessions yet. Run a live session first.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selected?.id === entry.id
                      ? 'border-lagoon/35 bg-lagoon/10 shadow-sm'
                      : 'border-ink/10 bg-white/74 hover:border-ink/24'
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">
                    {entry.templateId} • {entry.status.toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs text-ink/62">
                    Started {new Date(entry.startedAt).toLocaleString()} • Duration{' '}
                    {entry.endedAt
                      ? formatDuration(
                          Math.max(
                            0,
                            Math.round((new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000)
                          )
                        )
                      : 'in-progress'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/58">Replay Detail</h2>
          {selected ? (
            <>
              <div className="rounded-2xl border border-ink/10 bg-white/76 p-3 text-xs text-ink/66">
                <p>
                  ID: <span className="font-mono text-[11px] text-ink/78">{selected.id}</span>
                </p>
                <p className="mt-1">
                  Scene: <span className="font-semibold text-ink/78">{selected.activeSceneId}</span> • Transition:{' '}
                  <span className="font-semibold text-ink/78">{selected.sceneTransition}</span>
                </p>
                <p className="mt-1">
                  Samples: {selected.samples.length} • Phase events: {selected.phaseEvents.length} • Scene changes:{' '}
                  {selected.sceneChanges.length}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/76 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Recent phase events</p>
                <ul className="mt-2 space-y-1 text-xs text-ink/66">
                  {selected.phaseEvents.slice(-8).map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      {new Date(event.at).toLocaleTimeString()} • {event.phase.toUpperCase()} ({event.type})
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-ink/10 bg-white/75 p-3 text-sm text-ink/68">Select a session to preview details.</div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleImportClick}>
              Import JSON
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!selected}>
              Export selected
            </Button>
            <Button variant="ghost" onClick={handleDelete} disabled={!selected}>
              Remove selected
            </Button>
            <Button variant="ghost" onClick={handleClearAll} disabled={history.length === 0}>
              Clear all
            </Button>
          </div>

          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />

          <div className="pt-1">
            <Button asChild>
              <Link href="/ecstatic">Back to setup</Link>
            </Button>
          </div>

          {statusMessage ? <p className="text-xs text-ink/62">{statusMessage}</p> : null}
        </Card>
      </div>
    </div>
  );
}
