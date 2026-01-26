import { NextResponse } from 'next/server';

export const runtime = 'edge';

type ProcessingPayload = {
  compositionId?: string;
  tasks?: string[];
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProcessingPayload;
    const compositionId = typeof payload.compositionId === 'string' ? payload.compositionId : null;
    if (!compositionId) {
      return NextResponse.json({ error: 'Missing compositionId.' }, { status: 400 });
    }

    const tasks = Array.isArray(payload.tasks)
      ? payload.tasks.filter((task) => typeof task === 'string').slice(0, 5)
      : [];

    return NextResponse.json({ queued: true, compositionId, tasks });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
}
