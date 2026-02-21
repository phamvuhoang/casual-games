import { ImageResponse } from 'next/og';
import { compositionDescription, getCompositionSeoRecord } from '@/app/[locale]/(main)/composition/[id]/seo-data';

export const runtime = 'edge';
export const alt = 'Frequency Healing composition social preview';
export const size = {
  width: 1200,
  height: 600
};
export const contentType = 'image/png';

type ParamsInput = { id: string } | Promise<{ id: string }>;

function safeFrequency(value: number) {
  if (!Number.isFinite(value)) {
    return '--- Hz';
  }
  return `${Math.round(value * 100) / 100} Hz`;
}

export default async function Image({ params }: { params: ParamsInput }) {
  const resolvedParams = await Promise.resolve(params);
  const record = await getCompositionSeoRecord(resolvedParams.id);

  const title = record?.title?.trim() || 'Healing Session';
  const description = compositionDescription(record);
  const frequencies = (record?.frequencies ?? []).slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 12% 22%, rgba(143,122,219,0.82), transparent 42%), radial-gradient(circle at 80% 14%, rgba(106,146,194,0.58), transparent 40%), linear-gradient(142deg, #0f172a 0%, #203253 44%, #3f5b9a 100%)',
          color: '#f8fbff',
          padding: '52px 60px',
          fontFamily: 'Arial, sans-serif',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760, gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 18, letterSpacing: 3.1, textTransform: 'uppercase', opacity: 0.84 }}>
            Frequency Healing Studio
          </div>
          <div style={{ display: 'flex', fontSize: 50, lineHeight: 1.12, fontWeight: 700 }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 22, lineHeight: 1.3, maxWidth: 730, opacity: 0.9 }}>
            {description.length > 155 ? `${description.slice(0, 152)}...` : description}
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 8 }}>
            {frequencies.map((frequency, index) => (
              <div
                key={`${frequency}-${index}`}
                style={{
                  display: 'flex',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.52)',
                  background: 'rgba(255,255,255,0.14)',
                  padding: '8px 14px',
                  fontSize: 21,
                  fontWeight: 600
                }}
              >
                {safeFrequency(frequency)}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 150,
            height: 150,
            borderRadius: 999,
            border: '4px solid rgba(255,255,255,0.58)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 50,
            fontWeight: 700
          }}
        >
          FH
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
