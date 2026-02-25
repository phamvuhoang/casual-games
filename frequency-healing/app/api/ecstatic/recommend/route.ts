import { NextResponse } from 'next/server';
import { recommendEcstaticAction } from '@/lib/ecstatic/recommendation';
import type { EcstaticPhase } from '@/lib/ecstatic/types';

function isPhase(value: unknown): value is EcstaticPhase {
  return (
    value === 'arrival' ||
    value === 'grounding' ||
    value === 'build' ||
    value === 'peak' ||
    value === 'release' ||
    value === 'integration'
  );
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch (_error) {
    return NextResponse.json(
      {
        error: 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const body = payload as Record<string, unknown> | null;
  const phase = body?.phase;
  const metrics = (body?.metrics ?? {}) as Record<string, unknown>;

  if (!isPhase(phase)) {
    return NextResponse.json(
      {
        error: 'Invalid phase value.'
      },
      { status: 422 }
    );
  }

  const recommendation = recommendEcstaticAction(phase, {
    energy: asNumber(metrics.energy, 0),
    bass: asNumber(metrics.bass, 0),
    breathBpm:
      typeof metrics.breathBpm === 'number' && Number.isFinite(metrics.breathBpm) ? metrics.breathBpm : null,
    breathConfidence: asNumber(metrics.breathConfidence, 0),
    roomConfidence: asNumber(metrics.roomConfidence, 0)
  });

  return NextResponse.json({
    action: recommendation.action,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons
  });
}
