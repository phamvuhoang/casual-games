import { NextResponse } from 'next/server';
import { getEcstaticTemplates } from '@/lib/ecstatic/templates';

export async function GET() {
  const templates = getEcstaticTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    phasePlan: template.phasePlan
  }));

  return NextResponse.json({
    templates
  });
}
